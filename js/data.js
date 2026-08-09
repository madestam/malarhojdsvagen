// Datalagrets fasad: cache-först-läsning, optimistiska skrivningar med
// konflikt-omförsök, och polling som håller alla enheter i synk.
import { CONFIG } from './config.js';
import { fileCache } from './store/cache.js';
import { saveWithRetry } from './sync.js';
import { GithubStore, AuthError, RateLimitError, NetworkError } from './store/github-store.js';

let store = null;
let actor = null; // { id, name }

const changeCbs = new Set();
const statusCbs = new Set();
const queues = new Map();       // path -> senaste sparjobb (serialisering per fil)
const pendingDocs = new Map();  // path -> projicerat dokument inkl. okvitterade mutationer
const saveEpochs = new Map();   // path -> antal genomförda sparningar (för poll-race-vakt)
let activePaths = new Set();  // pollas ofta (aktuell vecka, aktiv jobbfil)
let pollTimer = null;
let pollSoonTimer = null;
let lastFamilyPoll = 0;
let rateLimitedUntil = 0;
let commitsCache = { at: 0, list: null };

export const weekPath = (weekId) => `weeks/${weekId}.json`;
export const jobsPath = (memberId) => `jobs/${memberId}.json`;

export function initData({ store: s, actor: a }) {
  store = s;
  actor = a || null;
}

export function setActor(a) {
  actor = a;
}

export function getStore() {
  return store;
}

export function onChange(cb) {
  changeCbs.add(cb);
  return () => changeCbs.delete(cb);
}

export function onStatus(cb) {
  statusCbs.add(cb);
  return () => statusCbs.delete(cb);
}

function emitChange(path, doc, meta = {}) {
  for (const cb of [...changeCbs]) cb(path, doc, meta);
}

function emitStatus(type) {
  for (const cb of [...statusCbs]) cb(type);
}

function handleError(err) {
  if (err instanceof AuthError) emitStatus('auth-error');
  else if (err instanceof RateLimitError) {
    rateLimitedUntil = Date.now() + 5 * 60_000;
    emitStatus('ratelimit');
  } else if (err instanceof NetworkError) emitStatus('offline');
}

export function getCached(path) {
  const e = fileCache.get(path);
  return e ? e.doc : null;
}

// Villkorad hämtning (ETag). Emittar 'change' bara när något faktiskt ändrats.
// Vakt mot race: ett GET-svar som hämtades före/under en sparning på samma fil
// får inte skriva över cachen med det gamla dokumentet (och gammalt sha).
export async function refresh(path, { force = false } = {}) {
  const entry = fileCache.get(path);
  const epoch = saveEpochs.get(path) || 0;
  const jobAtStart = queues.get(path);
  try {
    const res = await store.getFile(path, { etag: force ? undefined : entry?.etag });
    const raced = (saveEpochs.get(path) || 0) !== epoch
      || queues.get(path) !== jobAtStart
      || pendingDocs.has(path);
    if (raced) {
      emitStatus('online');
      return getCached(path); // nästa poll hämtar rent
    }
    if (res === null) {
      if (entry) fileCache.remove(path);
      emitChange(path, null);
      emitStatus('online');
      return null;
    }
    if (res.status === 304) {
      emitStatus('online');
      return entry.doc;
    }
    fileCache.set(path, { etag: res.etag, sha: res.sha, doc: res.doc, fetchedAt: new Date().toISOString() });
    emitChange(path, res.doc);
    emitStatus('online');
    return res.doc;
  } catch (err) {
    handleError(err);
    throw err;
  }
}

// Optimistisk mutation: UI:t får ändringen direkt, sedan sparas den med
// konflikt-omförsök. Förhandsvisningen bygger på det PROJICERADE dokumentet
// (inkl. tidigare okvitterade mutationer) så att snabba på-varandra-följande
// ändringar inte studsar visuellt. Vid fel rullas UI:t tillbaka till senast
// kända bekräftade version.
export function mutate(path, mutation, { emptyDoc } = {}) {
  const baseDoc = pendingDocs.has(path)
    ? pendingDocs.get(path)
    : (fileCache.get(path)?.doc ?? emptyDoc);
  const preview = structuredClone(baseDoc);
  mutation.apply(preview);
  pendingDocs.set(path, preview);
  emitChange(path, preview, { optimistic: true });

  const prev = queues.get(path) || Promise.resolve();
  const job = prev.catch(() => {}).then(async () => {
    const base = fileCache.get(path);
    const { doc, sha } = await saveWithRetry({
      store,
      path,
      mutation,
      entry: base ? { doc: base.doc, sha: base.sha } : null,
      emptyDoc,
      author: actor ? { name: actor.name, email: `${actor.id}@malarhojdsvagen.local` } : undefined,
      retryDelaysMs: CONFIG.saveRetryDelaysMs,
      stamp: (d) => {
        d.updatedAt = new Date().toISOString();
        if (actor) d.updatedBy = actor.id;
      },
    });
    saveEpochs.set(path, (saveEpochs.get(path) || 0) + 1);
    fileCache.set(path, { etag: null, sha, doc, fetchedAt: new Date().toISOString() });
    commitsCache.list = null;
    // Emittera det bekräftade dokumentet först när kön är tömd — annars
    // skulle det tillfälligt skriva över senare optimistiska ändringar.
    if (queues.get(path) === job) {
      pendingDocs.delete(path);
      emitChange(path, doc);
    }
    return doc;
  });
  queues.set(path, job);
  job.catch((err) => {
    if (queues.get(path) === job) {
      pendingDocs.delete(path);
      const e = fileCache.get(path);
      emitChange(path, e ? e.doc : null, { rollback: true });
    }
    handleError(err);
  });
  return job;
}

// --- Polling ---

export function setActivePaths(paths) {
  activePaths = new Set(paths);
}

export function startPolling() {
  stopPolling();
  pollTimer = setInterval(pollTick, CONFIG.pollActiveMs);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('focus', pollSoon);
  window.addEventListener('online', pollSoon);
}

export function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('focus', pollSoon);
  window.removeEventListener('online', pollSoon);
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') pollSoon();
}

// Kort fördröjning så att focus+visibility inte ger dubbla svep.
function pollSoon() {
  clearTimeout(pollSoonTimer);
  pollSoonTimer = setTimeout(pollTick, 400);
}

async function pollTick() {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  if (Date.now() < rateLimitedUntil) return;
  for (const path of activePaths) {
    try {
      await refresh(path);
    } catch {
      return; // status är redan emittad; avvakta till nästa svep
    }
  }
  if (Date.now() - lastFamilyPoll > CONFIG.pollFamilyMs) {
    lastFamilyPoll = Date.now();
    try {
      await refresh('family.json');
    } catch {
      /* redan hanterat */
    }
  }
}

// --- Övrigt ---

export async function recentChanges(limit = 15) {
  if (commitsCache.list && Date.now() - commitsCache.at < 60_000) return commitsCache.list;
  const list = await store.listCommits({ perPage: limit });
  commitsCache = { at: Date.now(), list };
  return list;
}

// Provar en nyckel genom att hämta family.json. Returnerar familjedokumentet.
export async function verifyToken(token) {
  const probe = new GithubStore({
    owner: CONFIG.dataOwner,
    repo: CONFIG.dataRepo,
    branch: CONFIG.branch,
    token,
  });
  const res = await probe.getFile('family.json');
  if (!res || res.status !== 200) throw new AuthError('family.json kunde inte hämtas');
  return res.doc;
}
