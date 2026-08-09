// Bootstrap: dev-läge, onboarding-gate, datalager, polling och renderloop.
import { CONFIG } from './config.js';
import { getState, setState, subscribe } from './store.js';
import { initRouter } from './router.js';
import * as data from './data.js';
import { GithubStore } from './store/github-store.js';
import { LocalStore } from './store/local-store.js';
import { tokenStore, identityStore, devFlag, fileCache } from './store/cache.js';
import { currentWeekId, addWeeks, isInReportWindow, currentMonthStr, isoDateStr, todayStockholm } from './dates.js';
import { normalizeWeek, normalizeJobs } from './models.js';
import { loadFamily, setWeek, routeChanged } from './controller.js';
import { toast } from './ui/toast.js';
import * as vecka from './views/vecka.js';
import * as sysslor from './views/sysslor.js';
import * as jobb from './views/jobb.js';
import * as mer from './views/mer.js';
import { startOnboarding, showKeyGate } from './views/onboarding.js';

const VIEWS = { vecka, sysslor, jobb, mer };

const appEl = document.getElementById('app');
const viewEl = document.getElementById('view');
const bannerEl = document.getElementById('banner');

let lastRoute = null;
let keyGateOpen = false;
let devStore = null;
let appWired = false; // skydd mot dubbla lyssnare när startApp körs igen (nyckelbyte)
let renderedDay = null;            // Stockholmsdag vid senaste rendering
let renderedWeekWasCurrent = false; // visade vi "aktuell vecka" då?

function renderBanner() {
  const s = getState();
  if (!s.online) {
    bannerEl.innerHTML = '<div class="banner">Offline – visar senast hämtade data</div>';
  } else if (s.connection === 'ratelimit') {
    bannerEl.innerHTML = '<div class="banner">GitHub bromsar oss – väntar en stund…</div>';
  } else {
    bannerEl.innerHTML = '';
  }
}

function renderJobBadge() {
  const s = getState();
  const badge = document.querySelector('.tab[data-route="jobb"] .tab-badge');
  if (!badge) return;
  let show = false;
  if (isInReportWindow() && s.family?.settings?.jobSeekers) {
    const month = currentMonthStr();
    show = s.family.settings.jobSeekers.some((id) => {
      const doc = s.jobs[id] || data.getCached(data.jobsPath(id));
      return doc && !(doc.reportedMonths || []).includes(month);
    });
  }
  badge.hidden = !show;
}

function renderApp() {
  const s = getState();
  renderedDay = isoDateStr(todayStockholm());
  renderedWeekWasCurrent = s.weekId === currentWeekId();

  for (const tab of document.querySelectorAll('.tabbar .tab')) {
    if (tab.dataset.route === s.route) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }

  renderBanner();
  renderJobBadge();

  // Omritningen förstör fokuserad knapp — kom ihåg dess nyckel och
  // återställ fokus efteråt (viktigt för tangentbord och skärmläsare).
  const focusKey = viewEl.contains(document.activeElement)
    ? document.activeElement.dataset?.fkey || null
    : null;

  const keepScroll = lastRoute === s.route ? window.scrollY : 0;
  if (lastRoute !== s.route) routeChanged();
  VIEWS[s.route].render(viewEl);
  window.scrollTo(0, keepScroll);
  if (viewEl.__autoscrollTo) {
    viewEl.__autoscrollTo.scrollIntoView({ block: 'start' });
    viewEl.__autoscrollTo = null;
  }
  if (focusKey) {
    viewEl.querySelector(`[data-fkey="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
  }
  lastRoute = s.route;
}

function wireDataEvents() {
  data.onChange((path, doc) => {
    const s = getState();
    if (path === 'family.json') {
      if (doc) {
        setState({ family: doc });
      }
      return;
    }
    if (s.weekId && path === data.weekPath(s.weekId)) {
      setState({ week: doc ? normalizeWeek(doc, s.weekId) : null, weekLoaded: true });
      return;
    }
    const jobsMatch = /^jobs\/(.+)\.json$/.exec(path);
    if (jobsMatch) {
      const id = jobsMatch[1];
      setState({ jobs: { ...s.jobs, [id]: normalizeJobs(doc, id) } });
    }
  });

  data.onStatus((type) => {
    if (type === 'online') {
      if (!getState().online || getState().connection) setState({ online: true, connection: null });
    } else if (type === 'offline') {
      if (getState().online) setState({ online: false });
    } else if (type === 'ratelimit') {
      setState({ connection: 'ratelimit' });
    } else if (type === 'auth-error') {
      openKeyGate();
    }
  });

  window.addEventListener('online', () => setState({ online: true }));
  window.addEventListener('offline', () => setState({ online: false }));

  // iOS fryser hemskärmsappar i timmar/dagar. Vid uppvaknande på en ny dag
  // måste vyn ritas om (Idag-markering, rapportbadge) och — om användaren
  // stod på det som då var aktuell vecka — följa med in i den nya veckan.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (renderedDay === isoDateStr(todayStockholm())) return;
    if (renderedWeekWasCurrent && getState().weekId !== currentWeekId()) {
      setWeek(currentWeekId());
    } else {
      setState({});
    }
  });
}

function openKeyGate() {
  if (keyGateOpen || getState().dev) return;
  keyGateOpen = true;
  data.stopPolling();
  showKeyGate({
    onDone: (token, familyDoc) => {
      keyGateOpen = false;
      tokenStore.set(token);
      startApp(false, familyDoc);
    },
  });
}

// Läser och konsumerar ?dev=1 / ?dev=0 ur adressraden.
function handleDevParam() {
  const params = new URLSearchParams(location.search);
  if (params.has('dev')) {
    devFlag.set(params.get('dev') === '1');
    params.delete('dev');
    const qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }
  return devFlag.get();
}

function makeStore(dev) {
  if (dev) {
    if (!devStore) devStore = new LocalStore();
    return devStore;
  }
  return new GithubStore({
    owner: CONFIG.dataOwner,
    repo: CONFIG.dataRepo,
    branch: CONFIG.branch,
    token: tokenStore.get(),
  });
}

function renderDevBadge(dev) {
  document.querySelector('.dev-badge')?.remove();
  if (!dev) return;
  const badge = document.createElement('button');
  badge.className = 'dev-badge';
  badge.textContent = 'DEV';
  badge.title = 'Tryck för att simulera en skrivkonflikt';
  badge.addEventListener('click', () => {
    devStore?.simulateConflictOnce();
    toast('Nästa sparning krockar (test av konflikthantering)');
  });
  document.body.appendChild(badge);
}

function startApp(dev, familyDoc = null) {
  document.getElementById('overlay').innerHTML = '';
  const store = makeStore(dev);
  data.initData({ store, actor: null });

  const weekId = currentWeekId();
  fileCache.purgeWeeks([addWeeks(weekId, -2), addWeeks(weekId, -1), weekId, addWeeks(weekId, 1), addWeeks(weekId, 2)]);

  setState({ dev, identity: identityStore.get(), weekId });
  if (familyDoc) {
    fileCache.set('family.json', { etag: null, sha: null, doc: familyDoc, fetchedAt: new Date().toISOString() });
  }

  if (!appWired) {
    appWired = true;
    wireDataEvents();
    initRouter();
    subscribe(renderApp);
  }
  appEl.hidden = false;
  renderDevBadge(dev);
  renderApp();

  loadFamily();
  setWeek(weekId);
  routeChanged();
  data.startPolling();
}

function boot() {
  const dev = handleDevParam();
  const needsKey = !dev && !tokenStore.get();
  const needsIdentity = !identityStore.get();

  if (needsKey || needsIdentity) {
    startOnboarding({
      dev,
      makeDevStore: () => makeStore(true),
      onDone: ({ token, identity, familyDoc }) => {
        if (token) tokenStore.set(token);
        if (identity) identityStore.set(identity);
        startApp(dev, familyDoc);
      },
    });
    return;
  }
  startApp(dev);
}

boot();

// Service workern registreras bara i produktion — lokalt stör cachen utvecklingen.
if ('serviceWorker' in navigator && location.hostname.endsWith('github.io')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
