// Mer: identitet, familjenyckel, senaste ändringar, installation och om.
import { CONFIG } from '../config.js';
import { getState, setState } from '../store.js';
import * as data from '../data.js';
import { verifyToken } from '../data.js';
import { tokenStore, identityStore } from '../store/cache.js';
import { relativeTime } from '../dates.js';
import { toast } from '../ui/toast.js';

let changes = null;        // null = ej hämtade, [] = tomt
let changesError = false;
let keyStatus = null;      // null | 'checking' | 'ok' | 'fel: ...'

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function render(container) {
  const s = getState();
  container.innerHTML = '';

  const header = el('header', 'view-header');
  header.appendChild(el('h1', 'view-title', 'Mer'));
  container.appendChild(header);

  container.appendChild(renderIdentity(s));
  container.appendChild(renderKey(s));
  container.appendChild(renderChanges());
  container.appendChild(renderInstall());
  container.appendChild(renderAbout(s));
}

// --- Vem är jag? ---

function renderIdentity(s) {
  const section = el('section', 'settings-section');
  section.appendChild(el('h2', 'settings-heading', 'Vem är jag?'));

  if (!s.family) {
    section.appendChild(el('p', 'caption', 'Hämtar familjen…'));
    return section;
  }

  const row = el('div', 'identity-row');
  for (const m of s.family.members) {
    const chip = el('button', 'identity-chip');
    chip.style.setProperty('--member-color', m.color);
    chip.setAttribute('aria-pressed', String(s.identity === m.id));
    const av = el('span', 'avatar', m.initial);
    av.style.setProperty('--member-color', m.color);
    av.style.width = '30px';
    av.style.height = '30px';
    av.style.fontSize = '14px';
    av.setAttribute('aria-hidden', 'true');
    chip.append(av, el('span', '', m.name));
    chip.addEventListener('click', () => {
      identityStore.set(m.id);
      data.setActor({ id: m.id, name: m.name });
      setState({ identity: m.id });
      toast(`Hej ${m.name}!`);
    });
    row.appendChild(chip);
  }
  section.appendChild(row);
  section.appendChild(el('p', 'caption', 'Används för att visa vem som gjort ändringar i schemat.'));
  return section;
}

// --- Familjenyckel ---

function renderKey(s) {
  const section = el('section', 'settings-section');
  section.appendChild(el('h2', 'settings-heading', 'Familjenyckel'));

  if (s.dev) {
    section.appendChild(el('p', 'caption', 'Dev-läge: appen kör mot lokal demodata och behöver ingen nyckel. Öppna appen med ?dev=0 för att gå tillbaka till skarpt läge.'));
    return section;
  }

  const row = el('div', 'input-row');
  row.style.marginTop = '10px';
  const input = document.createElement('input');
  input.className = 'input';
  input.type = 'password';
  input.autocomplete = 'off';
  input.autocapitalize = 'none';
  input.spellcheck = false;
  input.placeholder = 'github_pat_…';
  input.setAttribute('aria-label', 'Familjenyckel');
  const show = el('button', 'btn-quiet', 'Visa');
  show.setAttribute('aria-pressed', 'false');
  show.addEventListener('click', () => {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    show.textContent = showing ? 'Visa' : 'Dölj';
    show.setAttribute('aria-pressed', String(!showing));
  });
  row.append(input, show);
  section.appendChild(row);

  const status = el('p', keyStatus === 'ok' ? 'key-ok' : 'key-err');
  if (keyStatus === 'ok') status.textContent = 'Nyckeln fungerar ✓';
  else if (keyStatus === 'checking') status.textContent = 'Kontrollerar…';
  else if (keyStatus) status.textContent = keyStatus;
  section.appendChild(status);

  const save = el('button', 'btn btn-secondary btn-small', 'Spara nyckel');
  save.style.marginTop = '10px';
  save.addEventListener('click', async () => {
    const candidate = input.value.trim();
    if (!candidate) return;
    keyStatus = 'checking';
    status.className = 'caption';
    status.textContent = 'Kontrollerar…';
    save.disabled = true;
    try {
      await verifyToken(candidate);
      tokenStore.set(candidate);
      keyStatus = 'ok';
      toast('Nyckeln sparad');
      // Ladda om så att alla lager får den nya nyckeln
      setTimeout(() => location.reload(), 600);
    } catch {
      keyStatus = 'Nyckeln kunde inte verifieras. Kontrollera att hela nyckeln är kopierad.';
      save.disabled = false;
      setState({});
    }
  });
  section.appendChild(save);
  section.appendChild(el('p', 'caption', 'Nyckeln lagras bara på den här enheten.'));
  return section;
}

// --- Senaste ändringar ---

function renderChanges() {
  const section = el('section', 'settings-section');
  section.appendChild(el('h2', 'settings-heading', 'Senaste ändringar'));
  const card = el('div', 'card');

  if (changes === null && !changesError) {
    card.appendChild(el('p', 'caption', 'Hämtar…'));
    data.recentChanges(15)
      .then((list) => {
        changes = list;
        changesError = false;
        setState({});
      })
      .catch(() => {
        changesError = true;
        setState({});
      });
  } else if (changesError) {
    card.appendChild(el('p', 'caption', 'Kunde inte hämta ändringar.'));
    const retry = el('button', 'btn-quiet btn-small', 'Försök igen');
    retry.addEventListener('click', () => {
      changes = null;
      changesError = false;
      setState({});
    });
    card.appendChild(retry);
  } else if (changes.length === 0) {
    card.appendChild(el('p', 'caption', 'Inga ändringar än.'));
  } else {
    for (const c of changes) {
      const row = el('div', 'change-row');
      row.appendChild(el('p', 'change-msg', c.message));
      row.appendChild(el('p', 'change-time', c.date ? relativeTime(c.date) : ''));
      card.appendChild(row);
    }
  }
  section.appendChild(card);
  return section;
}

// --- Lägg till på hemskärmen ---

function renderInstall() {
  const section = el('section', 'settings-section');
  section.appendChild(el('h2', 'settings-heading', 'Lägg till på hemskärmen'));
  const card = el('div', 'card');

  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone) {
    card.appendChild(el('p', '', 'Redan installerad – snyggt! 🎉'));
  } else {
    const steps = el('ol', 'install-steps');
    for (const t of [
      'Öppna den här sidan i Safari på din iPhone.',
      'Tryck på dela-ikonen (rutan med pilen uppåt).',
      'Välj "Lägg till på hemskärmen" och tryck "Lägg till".',
      'Klart! Appen ligger nu som en egen ikon.',
    ]) {
      steps.appendChild(el('li', '', t));
    }
    card.appendChild(steps);
  }
  section.appendChild(card);
  return section;
}

// --- Om ---

function renderAbout(s) {
  const section = el('section', 'settings-section');
  section.appendChild(el('h2', 'settings-heading', 'Om'));
  const title = s.family?.settings?.title || 'Mälarhöjdsvägen';
  section.appendChild(el('p', 'about-line', `${title} · familjens veckoplanerare · version ${CONFIG.appVersion}`));
  section.appendChild(el('p', 'about-line', 'Byggd med kärlek (och en hel del promenader). 🐕🐕'));
  const link = el('a', 'about-line', 'Koden på GitHub ↗');
  link.href = CONFIG.repoUrl;
  link.target = '_blank';
  link.rel = 'noopener';
  link.style.display = 'inline-block';
  link.style.marginTop = '4px';
  section.appendChild(link);
  return section;
}
