// localStorage-spegel: familjenyckel, identitet och fil-cache per path.
// Allt är inslaget i try/catch — utan localStorage (privat läge, full disk)
// fungerar appen ändå, bara utan cache mellan starter.
const PREFIX = 'mhv.';

function get(key) {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function set(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, value);
  } catch {
    /* ignoreras */
  }
}

export const tokenStore = {
  get: () => get('token'),
  set: (t) => set('token', t),
  clear: () => set('token', null),
};

export const identityStore = {
  get: () => get('identity'),
  set: (id) => set('identity', id),
};

export const devFlag = {
  get: () => get('dev') === '1',
  set: (on) => set('dev', on ? '1' : null),
};

export const fileCache = {
  get(path) {
    const raw = get('cache.' + path);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  set(path, entry) {
    set('cache.' + path, JSON.stringify(entry));
  },
  remove(path) {
    set('cache.' + path, null);
  },
  // Rensa cachade veckofiler utanför det intressanta fönstret.
  purgeWeeks(keepWeekIds) {
    try {
      const keep = new Set(keepWeekIds.map((w) => PREFIX + 'cache.weeks/' + w + '.json'));
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX + 'cache.weeks/') && !keep.has(k)) {
          localStorage.removeItem(k);
        }
      }
    } catch {
      /* ignoreras */
    }
  },
};
