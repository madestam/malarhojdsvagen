// Sysslor: veckans fria uppgifter med snabbmallar, tilldelning och bockning.
import { getState } from '../store.js';
import { setWeek, mutateWeek, currentActor, memberById } from '../controller.js';
import { addWeeks, fmtWeekLabel, fmtWeekRange, DAY_KEYS, DAY_LABELS_SHORT } from '../dates.js';
import { randomId, mutChoreAdd, mutChoreToggle, mutChoreUpdate, mutChoreDelete } from '../models.js';
import { memberAvatar, memberPickerGrid } from '../ui/chips.js';
import { openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

let draftText = '';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function saveError() {
  toast('Kunde inte spara – kontrollera nätet och försök igen');
}

export function render(container) {
  const s = getState();
  container.innerHTML = '';

  const header = el('header', 'view-header');
  const nav = el('div', 'week-nav');
  const prev = el('button', 'week-nav-btn', '‹');
  prev.setAttribute('aria-label', 'Föregående vecka');
  prev.addEventListener('click', () => setWeek(addWeeks(s.weekId, -1)));
  const titleWrap = el('div', 'week-title-wrap');
  titleWrap.appendChild(el('h1', 'view-title', 'Sysslor'));
  titleWrap.appendChild(el('div', 'week-range', `${fmtWeekLabel(s.weekId)} · ${fmtWeekRange(s.weekId)}`));
  const next = el('button', 'week-nav-btn', '›');
  next.setAttribute('aria-label', 'Nästa vecka');
  next.addEventListener('click', () => setWeek(addWeeks(s.weekId, 1)));
  nav.append(prev, titleWrap, next);
  header.appendChild(nav);
  container.appendChild(header);

  if (!s.family || !s.weekLoaded) {
    const sk = el('div', 'skeleton');
    sk.style.height = '220px';
    sk.style.marginTop = '12px';
    container.appendChild(sk);
    return;
  }

  const chores = s.week?.chores || [];

  // Snabbmallar
  container.appendChild(el('p', 'quickadd-label', 'Lägg till snabbt:'));
  const quickRow = el('div', 'quickadd-row');
  const existingLabels = new Set(chores.map((c) => c.label.toLowerCase()));
  for (const t of s.family.choreTemplates || []) {
    const chip = el('button', 'template-chip', t.label);
    if (existingLabels.has(t.label.toLowerCase())) {
      chip.disabled = true;
      chip.textContent = t.label + ' ✓';
    } else {
      chip.addEventListener('click', () => addChore(t.label));
    }
    quickRow.appendChild(chip);
  }
  container.appendChild(quickRow);

  // Egen syssla
  const inputRow = el('div', 'input-row');
  inputRow.style.marginTop = '12px';
  const input = document.createElement('input');
  input.className = 'input';
  input.type = 'text';
  input.placeholder = 'Lägg till syssla…';
  input.setAttribute('aria-label', 'Ny syssla');
  input.value = draftText;
  input.addEventListener('input', () => {
    draftText = input.value;
    addBtn.disabled = !input.value.trim();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      addChore(input.value.trim());
      draftText = '';
    }
  });
  const addBtn = el('button', 'btn btn-small', 'Lägg till');
  addBtn.disabled = !draftText.trim();
  addBtn.addEventListener('click', () => {
    if (input.value.trim()) {
      addChore(input.value.trim());
      draftText = '';
    }
  });
  inputRow.append(input, addBtn);
  container.appendChild(inputRow);

  // Lista
  if (chores.length === 0) {
    const empty = el('div', 'empty-state');
    empty.appendChild(el('p', 'empty-title', 'Inga sysslor den här veckan'));
    empty.appendChild(el('p', 'empty-body', 'Lägg till från förslagen ovan eller skriv en egen.'));
    container.appendChild(empty);
    return;
  }

  const openChores = chores.filter((c) => !c.done);
  const doneChores = chores.filter((c) => c.done);

  const card = el('div', 'card');
  const headRow = el('div', 'day-head');
  headRow.appendChild(el('h2', 'card-title', 'Veckans sysslor'));
  headRow.appendChild(el('span', 'done-count', `${doneChores.length}/${chores.length} klara`));
  card.appendChild(headRow);

  for (const chore of [...openChores, ...doneChores]) {
    card.appendChild(renderChoreRow(chore));
  }
  container.appendChild(card);

  if (doneChores.length === chores.length && chores.length > 0) {
    container.appendChild(el('p', 'all-done', 'Allt klart – bra jobbat allihop! 🎉'));
  }
}

function addChore(label) {
  const chore = { id: randomId(4), label, assignees: [], day: null, done: false };
  mutateWeek(mutChoreAdd({ weekId: getState().weekId, chore, actorName: currentActor().name }))
    .then(() => toast('Tillagd: ' + label))
    .catch(saveError);
}

function renderChoreRow(chore) {
  const row = el('div', 'chore-row' + (chore.done ? ' done' : ''));

  const check = el('button', 'chore-check');
  check.setAttribute('role', 'checkbox');
  check.setAttribute('aria-checked', String(chore.done));
  check.setAttribute('aria-label', `Markera ${chore.label} som ${chore.done ? 'ej klar' : 'klar'}`);
  const box = el('span', 'box');
  box.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
  check.appendChild(box);
  check.addEventListener('click', () => {
    mutateWeek(mutChoreToggle({
      weekId: getState().weekId,
      choreId: chore.id,
      choreLabel: chore.label,
      done: !chore.done,
      actorName: currentActor().name,
    })).catch(saveError);
  });
  row.appendChild(check);

  const main = el('button', 'chore-main');
  main.setAttribute('aria-label', `Redigera ${chore.label}`);
  main.appendChild(el('span', 'chore-label', chore.label));
  const meta = el('span', 'chore-meta');
  if (chore.day) meta.appendChild(el('span', 'chore-day-tag', DAY_LABELS_SHORT[chore.day] || chore.day));
  for (const id of chore.assignees || []) {
    const m = memberById(id);
    if (m) {
      const av = memberAvatar(m, 18);
      av.style.fontSize = '9px';
      meta.appendChild(av);
      meta.appendChild(el('span', '', m.name));
    }
  }
  if (meta.childNodes.length) main.appendChild(meta);
  main.addEventListener('click', () => openChoreSheet(chore));
  row.appendChild(main);

  const chev = el('span', 'chevron');
  chev.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
  row.appendChild(chev);

  return row;
}

function openChoreSheet(chore) {
  let label = chore.label;
  let assignees = [...(chore.assignees || [])];
  let day = chore.day || '';

  openSheet({
    title: 'Redigera syssla',
    build({ body, close }) {
      const f1 = el('div', 'field');
      const l1 = el('label', '', 'Vad ska göras?');
      l1.setAttribute('for', 'chore-label-input');
      const input = document.createElement('input');
      input.className = 'input';
      input.id = 'chore-label-input';
      input.type = 'text';
      input.value = label;
      input.addEventListener('input', () => { label = input.value; });
      f1.append(l1, input);
      body.appendChild(f1);

      const f2 = el('div', 'field');
      f2.appendChild(el('label', '', 'Vem gör det?'));
      f2.appendChild(memberPickerGrid({
        members: getState().family.members,
        selected: assignees,
        multi: true,
        onChange(ids) { assignees = ids; },
      }));
      body.appendChild(f2);

      const f3 = el('div', 'field');
      const l3 = el('label', '', 'Vilken dag?');
      l3.setAttribute('for', 'chore-day-select');
      const select = document.createElement('select');
      select.className = 'input';
      select.id = 'chore-day-select';
      const optAny = document.createElement('option');
      optAny.value = '';
      optAny.textContent = 'Ingen särskild dag';
      select.appendChild(optAny);
      for (const k of DAY_KEYS) {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = DAY_LABELS_SHORT[k];
        if (k === day) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => { day = select.value; });
      f3.append(l3, select);
      body.appendChild(f3);

      const save = el('button', 'btn', 'Spara');
      save.style.width = '100%';
      save.style.marginTop = '16px';
      save.addEventListener('click', () => {
        const updated = { ...chore, label: label.trim() || chore.label, assignees, day: day || null };
        close();
        mutateWeek(mutChoreUpdate({ weekId: getState().weekId, chore: updated, actorName: currentActor().name }))
          .catch(saveError);
      });
      body.appendChild(save);

      const del = el('button', 'btn-quiet btn-danger-quiet', 'Ta bort');
      del.style.width = '100%';
      del.style.marginTop = '6px';
      del.addEventListener('click', () => {
        close();
        const snapshot = { ...chore };
        mutateWeek(mutChoreDelete({
          weekId: getState().weekId, choreId: chore.id, choreLabel: chore.label, actorName: currentActor().name,
        }))
          .then(() => {
            toast('Sysslan togs bort', {
              action: {
                label: 'Ångra',
                onClick: () => {
                  mutateWeek(mutChoreAdd({
                    weekId: getState().weekId, chore: snapshot, actorName: currentActor().name, restored: true,
                  })).catch(saveError);
                },
              },
            });
          })
          .catch(saveError);
      });
      body.appendChild(del);
    },
  });
}
