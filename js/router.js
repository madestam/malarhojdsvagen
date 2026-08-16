// Hash-router: #/vecka  #/sysslor  #/jobb  #/mer
import { setState } from './store.js';

export const ROUTES = ['idag', 'vecka', 'sysslor', 'jobb', 'mer'];

export function currentRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  return ROUTES.includes(h) ? h : 'idag';
}

export function navigate(route) {
  location.hash = '#/' + route;
}

export function initRouter() {
  window.addEventListener('hashchange', () => {
    setState({ route: currentRoute() });
  });
  setState({ route: currentRoute() });
}
