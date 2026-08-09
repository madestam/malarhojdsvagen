// Styrlagret mellan vyerna och datalagret: laddar dokument in i app-staten
// och exponerar mutationshjälpare. Vyerna importerar härifrån — aldrig
// direkt från data.js för skrivningar.
import * as data from './data.js';
import { getState, setState } from './store.js';
import { normalizeWeek, normalizeJobs, emptyWeek, emptyJobs } from './models.js';
import { currentWeekId } from './dates.js';
import { identityStore } from './store/cache.js';

export function currentActor() {
  const s = getState();
  const m = s.family?.members?.find((x) => x.id === s.identity);
  return m ? { id: m.id, name: m.name } : { id: s.identity || 'okand', name: 'Okänd' };
}

export function memberById(id) {
  return getState().family?.members?.find((m) => m.id === id) || null;
}

function updateActivePaths() {
  const s = getState();
  const paths = [];
  if (s.weekId) paths.push(data.weekPath(s.weekId));
  if (s.route === 'jobb' && s.jobPerson) paths.push(data.jobsPath(s.jobPerson));
  data.setActivePaths(paths);
}

export function applyFamily(doc) {
  setState({ family: doc });
  const id = identityStore.get();
  const m = doc?.members?.find((x) => x.id === id);
  if (m) data.setActor({ id: m.id, name: m.name });
}

export async function loadFamily() {
  const cached = data.getCached('family.json');
  if (cached) applyFamily(cached);
  try {
    const doc = await data.refresh('family.json');
    if (doc) applyFamily(doc);
  } catch {
    /* status hanteras centralt */
  }
}

export async function setWeek(weekId) {
  setState({ weekId, week: null, weekLoaded: false, weekError: false });
  const path = data.weekPath(weekId);
  const cached = data.getCached(path);
  if (cached) {
    setState({ week: normalizeWeek(cached, weekId), weekLoaded: true, usingCache: true });
  }
  updateActivePaths();
  try {
    const doc = await data.refresh(path);
    if (getState().weekId !== weekId) return;
    setState({ week: doc ? normalizeWeek(doc, weekId) : null, weekLoaded: true, usingCache: false });
  } catch {
    if (getState().weekId !== weekId) return;
    setState({ weekLoaded: true, weekError: !cached });
  }
}

export function goToCurrentWeek() {
  return setWeek(currentWeekId());
}

export async function loadJobs(memberId) {
  setState({ jobPerson: memberId });
  const path = data.jobsPath(memberId);
  const cached = data.getCached(path);
  if (cached) {
    setState({ jobs: { ...getState().jobs, [memberId]: normalizeJobs(cached, memberId) } });
  }
  updateActivePaths();
  try {
    const doc = await data.refresh(path);
    setState({ jobs: { ...getState().jobs, [memberId]: normalizeJobs(doc || cached, memberId) } });
  } catch {
    if (!cached) {
      setState({ jobs: { ...getState().jobs, [memberId]: normalizeJobs(null, memberId) } });
    }
  }
}

export function routeChanged() {
  updateActivePaths();
}

// --- Mutationer (optimistiska, med konflikt-omförsök i datalagret) ---

export function mutateWeek(mutation) {
  const s = getState();
  return data.mutate(data.weekPath(s.weekId), mutation, { emptyDoc: emptyWeek(s.weekId) });
}

export function mutateJobs(memberId, mutation) {
  return data.mutate(data.jobsPath(memberId), mutation, { emptyDoc: emptyJobs(memberId) });
}
