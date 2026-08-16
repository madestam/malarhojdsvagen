// Enkel central state med pub/sub. Vyerna ritas om vid varje setState.
const state = {
  route: 'idag',
  weekId: null,        // vald vecka, t.ex. "2026-W33"
  family: null,        // family.json-dokumentet
  week: null,          // veckodokument för state.weekId (null = saknas/ej laddad)
  weekLoaded: false,   // true när laddningsförsöket är klart (även vid 404)
  weekError: false,
  jobs: {},            // memberId -> jobbdokument
  jobPerson: null,     // vald flik i Jobb-vyn
  identity: null,      // inloggad medlems id
  online: true,
  usingCache: false,   // true = visar cachad data utan färsk kontakt
  dev: false,
  startedEmptyWeeks: new Set(), // veckor där "Börja tomt" valts
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(partial) {
  Object.assign(state, partial);
  for (const fn of [...listeners]) fn(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
