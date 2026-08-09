// Onboarding vid första start (välkommen → familjenyckel → vem är du?)
// samt nyckel-grinden när en nyckel slutat fungera.
import { verifyToken } from '../data.js';
import { tokenStore } from '../store/cache.js';
import { AuthError, NetworkError, RateLimitError } from '../store/github-store.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function overlayRoot() {
  return document.getElementById('overlay');
}

function renderShell(dotIndex, dotCount) {
  const root = overlayRoot();
  root.innerHTML = '';
  const wrap = el('div', 'onboarding');
  const inner = el('div', 'onboarding-inner');
  wrap.appendChild(inner);
  if (dotCount > 1) {
    const dots = el('div', 'dots');
    for (let i = 0; i < dotCount; i++) {
      const d = el('span', i === dotIndex ? 'active' : '');
      dots.appendChild(d);
    }
    wrap.appendChild(dots);
  }
  root.appendChild(wrap);
  return inner;
}

function keyField() {
  const field = el('div', 'field');
  const label = el('label', '', 'Familjenyckel');
  label.setAttribute('for', 'family-key-input');
  const row = el('div', 'input-row');
  const input = document.createElement('input');
  input.className = 'input';
  input.id = 'family-key-input';
  input.type = 'password';
  input.autocomplete = 'off';
  input.autocapitalize = 'none';
  input.spellcheck = false;
  input.placeholder = 'github_pat_…';
  const show = el('button', 'btn-quiet', 'Visa');
  show.type = 'button';
  show.setAttribute('aria-pressed', 'false');
  show.addEventListener('click', () => {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    show.textContent = showing ? 'Visa' : 'Dölj';
    show.setAttribute('aria-pressed', String(!showing));
  });
  row.append(input, show);
  field.append(label, row);
  return { field, input };
}

function errorMessage(err) {
  if (err instanceof AuthError) {
    return 'Hmm, den nyckeln fungerade inte. Kontrollera att du kopierade hela nyckeln och försök igen.';
  }
  if (err instanceof RateLimitError) {
    return 'GitHub bromsar oss just nu – vänta en stund och försök igen.';
  }
  if (err instanceof NetworkError) {
    return 'Ingen kontakt med servern. Kolla nätet och försök igen.';
  }
  return 'Något gick fel. Försök igen.';
}

export function startOnboarding({ dev, makeDevStore, onDone }) {
  const dotCount = dev ? 2 : 3;
  let token = tokenStore.get() || null;

  function stepWelcome() {
    const inner = renderShell(0, dotCount);
    inner.appendChild(el('div', 'onboarding-emoji', '🐕🐕'));
    inner.appendChild(el('h1', '', 'Välkommen till Mälarhöjdsvägen'));
    inner.appendChild(el('p', 'lede',
      'Familjens gemensamma plan för veckan: vem som går ut med hundarna, vem som lagar middag, ' +
      'och hur det går med jobbsökandet. Alla ser samma sak – och alla kan ändra.'));
    const actions = el('div', 'onboarding-actions');
    const btn = el('button', 'btn', 'Kom igång');
    btn.addEventListener('click', () => (dev || token ? stepIdentity() : stepKey()));
    actions.appendChild(btn);
    inner.appendChild(actions);
  }

  function stepKey(prefillError = '') {
    const inner = renderShell(1, dotCount);
    inner.appendChild(el('div', 'onboarding-emoji', '🔑'));
    inner.appendChild(el('h1', '', 'Klistra in familjenyckeln'));
    inner.appendChild(el('p', 'lede',
      'Nyckeln låser upp familjens gemensamma data. Den finns i familjens anteckning – eller fråga Andreas.'));

    const { field, input } = keyField();
    inner.appendChild(field);

    const err = el('p', 'key-err', prefillError);
    err.setAttribute('role', 'alert');
    inner.appendChild(err);

    const actions = el('div', 'onboarding-actions');
    const btn = el('button', 'btn', 'Klar');
    btn.addEventListener('click', async () => {
      const candidate = input.value.trim();
      if (!candidate) return;
      btn.disabled = true;
      btn.textContent = 'Kontrollerar nyckeln…';
      err.textContent = '';
      try {
        const familyDoc = await verifyToken(candidate);
        token = candidate;
        stepIdentity(familyDoc);
      } catch (e) {
        err.textContent = errorMessage(e);
        btn.disabled = false;
        btn.textContent = 'Klar';
      }
    });
    actions.appendChild(btn);
    inner.appendChild(actions);
    input.focus();
  }

  async function stepIdentity(familyDoc = null) {
    const inner = renderShell(dotCount - 1, dotCount);
    inner.appendChild(el('h1', '', 'Vem är du?'));
    inner.appendChild(el('p', 'lede', 'Används för att visa vem som gjort ändringar i schemat.'));

    if (!familyDoc) {
      const loading = el('p', 'lede', 'Hämtar familjen…');
      inner.appendChild(loading);
      try {
        if (dev) {
          const res = await makeDevStore().getFile('family.json');
          familyDoc = res.doc;
        } else {
          familyDoc = await verifyToken(token);
        }
      } catch (e) {
        if (!dev && e instanceof AuthError) {
          tokenStore.clear();
          token = null;
          stepKey(errorMessage(e));
          return;
        }
        loading.textContent = errorMessage(e);
        const retry = el('button', 'btn', 'Försök igen');
        retry.style.marginTop = '14px';
        retry.addEventListener('click', () => stepIdentity());
        inner.appendChild(retry);
        return;
      }
      loading.remove();
    }

    let chosen = null;
    const grid = el('div', 'identity-row');
    grid.style.justifyContent = 'center';
    grid.style.marginTop = '18px';
    for (const m of familyDoc.members) {
      const chip = el('button', 'identity-chip');
      chip.style.setProperty('--member-color', m.color);
      chip.setAttribute('aria-pressed', 'false');
      const av = el('span', 'avatar', m.initial);
      av.style.setProperty('--member-color', m.color);
      av.style.width = '30px';
      av.style.height = '30px';
      av.style.fontSize = '14px';
      av.setAttribute('aria-hidden', 'true');
      chip.append(av, el('span', '', m.name));
      chip.addEventListener('click', () => {
        chosen = m.id;
        for (const c of grid.children) c.setAttribute('aria-pressed', 'false');
        chip.setAttribute('aria-pressed', 'true');
        cont.disabled = false;
      });
      grid.appendChild(chip);
    }
    inner.appendChild(grid);

    const actions = el('div', 'onboarding-actions');
    const cont = el('button', 'btn', 'Fortsätt');
    cont.disabled = true;
    cont.addEventListener('click', () => {
      onDone({ token, identity: chosen, familyDoc });
    });
    actions.appendChild(cont);
    inner.appendChild(actions);
  }

  stepWelcome();
}

// Visas när en tidigare fungerande nyckel börjat ge 401.
export function showKeyGate({ onDone }) {
  const inner = renderShell(0, 1);
  inner.appendChild(el('div', 'onboarding-emoji', '🔑'));
  inner.appendChild(el('h1', '', 'Familjenyckeln har slutat fungera'));
  inner.appendChild(el('p', 'lede',
    'Den kan ha gått ut. Be Andreas om en ny nyckel och klistra in den här, så är du igång igen.'));

  const { field, input } = keyField();
  inner.appendChild(field);

  const err = el('p', 'key-err', '');
  err.setAttribute('role', 'alert');
  inner.appendChild(err);

  const actions = el('div', 'onboarding-actions');
  const btn = el('button', 'btn', 'Spara nyckel');
  btn.addEventListener('click', async () => {
    const candidate = input.value.trim();
    if (!candidate) return;
    btn.disabled = true;
    btn.textContent = 'Kontrollerar…';
    err.textContent = '';
    try {
      const familyDoc = await verifyToken(candidate);
      onDone(candidate, familyDoc);
    } catch (e) {
      err.textContent = errorMessage(e);
      btn.disabled = false;
      btn.textContent = 'Spara nyckel';
    }
  });
  actions.appendChild(btn);
  inner.appendChild(actions);
  input.focus();
}
