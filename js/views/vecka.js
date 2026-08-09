// Veckovyn: dagkort med hundpromenader och middag, veckonavigering,
// rättvise-räknare och tomvecko-flöde.
import { getState, setState } from '../store.js';
import { setWeek, goToCurrentWeek, mutateWeek, currentActor, memberById } from '../controller.js';
import * as data from '../data.js';
import {
  DAY_KEYS, DAY_LABELS_SHORT, weekDates, addWeeks, currentWeekId,
  fmtWeekLabel, fmtWeekRange, fmtDayTitle, isoDateStr, todayStockholm,
} from '../dates.js';
import { normalizeWeek, emptyWeek, mutCopyWeekFrom, mutSetWeekNote } from '../models.js';
import { memberChip } from '../ui/chips.js';
import { openSlotPicker } from './veckaPicker.js';
import { openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

let lastAutoScrolledWeek = null;

const SLOT_EMOJI = { dog: '🐕', cook: '🍳' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function sortedSlots(family) {
  return [...(family.slots || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
}

function weekHasContent(week) {
  if (!week) return false;
  const slotsUsed = Object.values(week.days || {}).some((d) =>
    Object.values(d.slots || {}).some((ids) => ids && ids.length > 0)
  );
  return slotsUsed || (week.chores || []).length > 0;
}

export function render(container) {
  const s = getState();
  container.innerHTML = '';

  container.appendChild(renderHeader(s));

  if (!s.family || !s.weekLoaded) {
    for (let i = 0; i < 4; i++) {
      const sk = el('div', 'skeleton');
      sk.style.height = '180px';
      sk.style.marginTop = '12px';
      container.appendChild(sk);
    }
    return;
  }

  if (s.weekError && !s.week) {
    const card = el('div', 'card empty-state');
    card.appendChild(el('p', 'empty-title', 'Kunde inte hämta veckan'));
    card.appendChild(el('p', 'empty-body', 'Kontrollera nätet och försök igen.'));
    const actions = el('div', 'empty-actions');
    const retry = el('button', 'btn', 'Försök igen');
    retry.addEventListener('click', () => setWeek(s.weekId));
    actions.appendChild(retry);
    card.appendChild(actions);
    container.appendChild(card);
    return;
  }

  const isEmpty = !weekHasContent(s.week);
  if (isEmpty && !s.startedEmptyWeeks.has(s.weekId)) {
    container.appendChild(renderEmptyState(s));
    return;
  }

  const week = s.week || emptyWeek(s.weekId);
  const days = weekDates(s.weekId);
  const todayStr = isoDateStr(todayStockholm());
  const slots = sortedSlots(s.family);

  DAY_KEYS.forEach((dayKey, i) => {
    container.appendChild(renderDayCard(s, week, dayKey, days[i], todayStr, slots));
  });

  // Autoscrolla till idag första gången aktuell vecka visas. Själva
  // scrollningen görs av renderloopen i app.js (efter scroll-återställningen).
  if (s.weekId === currentWeekId() && lastAutoScrolledWeek !== s.weekId) {
    const todayCard = container.querySelector('.day-card.today');
    if (todayCard && todayCard !== container.querySelector('.day-card')) {
      lastAutoScrolledWeek = s.weekId;
      container.__autoscrollTo = todayCard;
    }
  }
}

function renderHeader(s) {
  const header = el('header', 'view-header');

  const nav = el('div', 'week-nav');
  const prev = el('button', 'week-nav-btn', '‹');
  prev.setAttribute('aria-label', 'Föregående vecka');
  prev.dataset.fkey = 'week-prev';
  prev.addEventListener('click', () => setWeek(addWeeks(s.weekId, -1)));

  const titleWrap = el('div', 'week-title-wrap');
  const h1 = el('h1', 'week-title', fmtWeekLabel(s.weekId));
  const range = el('div', 'week-range', fmtWeekRange(s.weekId));
  titleWrap.append(h1, range);

  const next = el('button', 'week-nav-btn', '›');
  next.setAttribute('aria-label', 'Nästa vecka');
  next.dataset.fkey = 'week-next';
  next.addEventListener('click', () => setWeek(addWeeks(s.weekId, 1)));

  nav.append(prev, titleWrap, next);
  header.appendChild(nav);

  if (s.weekId !== currentWeekId()) {
    const todayBtn = el('button', 'week-today-btn', 'Idag');
    todayBtn.dataset.fkey = 'week-today';
    todayBtn.addEventListener('click', goToCurrentWeek);
    header.appendChild(todayBtn);
  }

  if (s.family && s.week) {
    header.appendChild(renderLoadChips(s));
  }

  if (s.family && s.weekLoaded && (s.week || s.startedEmptyWeeks.has(s.weekId))) {
    header.appendChild(renderNoteRow(s));
  }

  return header;
}

// Veckans fördelning: antal pass per person.
function renderLoadChips(s) {
  const counts = Object.fromEntries(s.family.members.map((m) => [m.id, 0]));
  for (const day of Object.values(s.week.days || {})) {
    for (const ids of Object.values(day.slots || {})) {
      for (const id of ids || []) {
        if (id in counts) counts[id]++;
      }
    }
  }
  const wrap = el('div', 'week-loads');
  for (const m of s.family.members) {
    const chip = el('span', 'load-chip' + (counts[m.id] === 0 ? ' dim' : ''));
    // role=img gör att aria-label faktiskt läses upp (aria-label på en
    // generisk span ignoreras av flera skärmläsare).
    chip.setAttribute('role', 'img');
    chip.setAttribute('aria-label', `${m.name}: ${counts[m.id]} pass denna vecka`);
    const av = el('span', 'avatar', m.initial);
    av.style.setProperty('--member-color', m.color);
    av.style.width = '22px';
    av.style.height = '22px';
    av.style.fontSize = '11px';
    av.setAttribute('aria-hidden', 'true');
    chip.append(av, el('span', '', String(counts[m.id])));
    wrap.appendChild(chip);
  }
  return wrap;
}

function renderNoteRow(s) {
  const note = s.week?.note || '';
  const row = el('div', 'week-note-row');
  const btn = el('button', '');
  btn.dataset.fkey = 'week-note';
  if (note) {
    btn.appendChild(el('span', 'week-note-text', '📝 ' + note));
    btn.setAttribute('aria-label', 'Ändra veckans anteckning');
  } else {
    btn.textContent = '+ Anteckning för veckan';
  }
  btn.addEventListener('click', () => openNoteSheet(note));
  row.appendChild(btn);
  return row;
}

function openNoteSheet(existing) {
  openSheet({
    title: 'Veckans anteckning',
    build({ body, close }) {
      const field = el('div', 'field');
      const label = el('label', '', 'Något hela familjen bör veta denna vecka?');
      label.setAttribute('for', 'week-note-input');
      const ta = document.createElement('textarea');
      ta.className = 'textarea';
      ta.id = 'week-note-input';
      ta.placeholder = 'T.ex. "Mormor kommer på torsdag"';
      ta.value = existing;
      field.append(label, ta);

      const save = el('button', 'btn', 'Spara');
      save.style.marginTop = '14px';
      save.style.width = '100%';
      save.addEventListener('click', () => {
        const note = ta.value.trim();
        close();
        mutateWeek(mutSetWeekNote({ weekId: getState().weekId, note, actorName: currentActor().name }))
          .catch(() => toast('Kunde inte spara – kontrollera nätet och försök igen'));
      });
      body.append(field, save);
    },
  });
}

function renderEmptyState(s) {
  const dogs = (s.family.dogs || []).map((d) => d.name).join(' & ');
  const card = el('div', 'card empty-state');
  card.appendChild(el('div', 'empty-emoji', '🐕🐕'));
  card.appendChild(el('p', 'empty-title', 'Veckan är inte planerad än'));
  card.appendChild(el('p', 'empty-body', dogs ? `${dogs} väntar…` : 'Dags att planera!'));

  const actions = el('div', 'empty-actions');

  const copyBtn = el('button', 'btn', 'Kopiera förra veckan');
  copyBtn.addEventListener('click', () => copyPreviousWeek(s.weekId, copyBtn));
  actions.appendChild(copyBtn);

  const emptyBtn = el('button', 'btn-quiet', 'Börja tomt');
  emptyBtn.addEventListener('click', () => {
    s.startedEmptyWeeks.add(s.weekId);
    setState({});
  });
  actions.appendChild(emptyBtn);

  card.appendChild(actions);
  return card;
}

async function copyPreviousWeek(weekId, btn) {
  btn.disabled = true;
  const prevId = addWeeks(weekId, -1);
  let prevDoc = data.getCached(data.weekPath(prevId));
  if (!prevDoc) {
    try {
      prevDoc = await data.refresh(data.weekPath(prevId));
    } catch {
      toast('Kunde inte hämta förra veckan – kontrollera nätet');
      btn.disabled = false;
      return;
    }
  }
  const norm = prevDoc ? normalizeWeek(prevDoc, prevId) : null;
  if (!weekHasContent(norm)) {
    toast('Förra veckan är också tom');
    btn.disabled = false;
    return;
  }
  try {
    await mutateWeek(mutCopyWeekFrom({
      weekId, fromWeekId: prevId, fromDoc: norm, actorName: currentActor().name,
    }));
    toast('Förra veckans schema kopierat');
  } catch {
    toast('Kunde inte spara – kontrollera nätet och försök igen');
    btn.disabled = false;
  }
}

function renderDayCard(s, week, dayKey, dateUTC, todayStr, slots) {
  const isToday = isoDateStr(dateUTC) === todayStr;
  const card = el('section', 'card day-card' + (isToday ? ' today' : ''));

  const head = el('div', 'day-head');
  head.appendChild(el('h2', 'day-title', fmtDayTitle(dateUTC)));
  if (isToday) head.appendChild(el('span', 'today-pill', 'Idag'));
  card.appendChild(head);

  const day = week.days[dayKey] || { slots: {} };

  for (const slot of slots) {
    const ids = day.slots[slot.id] || [];
    const row = el('button', 'slot-row');
    row.type = 'button';
    row.dataset.fkey = `slot:${dayKey}:${slot.id}`;

    const names = ids.map((id) => memberById(id)?.name || id);
    const dogSubtitle = slot.kind === 'dog' ? 'promenad' : '';
    row.setAttribute(
      'aria-label',
      `${slot.label} ${DAY_LABELS_SHORT[dayKey]}${dogSubtitle ? '' : ''}: ${names.length ? names.join(' och ') : 'ingen vald'}. Ändra`
    );

    const label = el('span', 'slot-label');
    const emoji = el('span', '', SLOT_EMOJI[slot.kind] || '📌');
    emoji.setAttribute('aria-hidden', 'true');
    label.append(emoji, el('span', '', slot.shortLabel || slot.label));
    row.appendChild(label);

    const chips = el('span', 'slot-chips');
    if (ids.length === 0) {
      chips.appendChild(el('span', 'ghost-chip', 'Vem?'));
    } else {
      for (const id of ids) {
        const m = memberById(id);
        if (m) chips.appendChild(memberChip(m));
        else chips.appendChild(el('span', 'ghost-chip', id));
      }
    }
    row.appendChild(chips);

    row.addEventListener('click', () => openSlotPicker({ dayKey, slot, dateUTC }));
    card.appendChild(row);
  }

  return card;
}
