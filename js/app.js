// Bootstrap: router, renderloop och (senare) datalager + onboarding.
import { getState, setState, subscribe } from './store.js';
import { initRouter } from './router.js';
import * as vecka from './views/vecka.js';
import * as sysslor from './views/sysslor.js';
import * as jobb from './views/jobb.js';
import * as mer from './views/mer.js';

const VIEWS = { vecka, sysslor, jobb, mer };

const appEl = document.getElementById('app');
const viewEl = document.getElementById('view');

let lastRoute = null;

function renderApp() {
  const state = getState();

  // Flikradens aktiva läge
  for (const tab of document.querySelectorAll('.tabbar .tab')) {
    if (tab.dataset.route === state.route) {
      tab.setAttribute('aria-current', 'page');
    } else {
      tab.removeAttribute('aria-current');
    }
  }

  // Behåll scrolläget vid omritning inom samma vy, nollställ vid byte
  const keepScroll = lastRoute === state.route ? window.scrollY : 0;
  VIEWS[state.route].render(viewEl);
  window.scrollTo(0, keepScroll);
  lastRoute = state.route;
}

function boot() {
  initRouter();
  subscribe(renderApp);
  appEl.hidden = false;
  renderApp();
}

boot();

// Service workern registreras bara i produktion — lokalt stör cachen utvecklingen.
if ('serviceWorker' in navigator && location.hostname.endsWith('github.io')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
