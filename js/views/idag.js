// Idag — hemvyn: hälsning, dagens schema, dina pass, sysslor och
// rapportpåminnelse. Visar alltid innevarande vecka.
import { getState } from '../store.js';
import { setWeek, mutateWeek, currentActor, memberById } from '../controller.js';
import { navigate } from '../router.js';
import * as data from '../data.js';
import {
  DAY_KEYS, DAY_LABELS_SHORT, weekDates, currentWeekId, isoDateStr, todayStockholm,
  fmtDayTitle, fmtWeekLabel, isInReportWindow, currentMonthStr,
} from '../dates.js';
import { dogsForSlot, mutChoreToggle } from '../models.js';
import { memberChip } from '../ui/chips.js';
import { openSlotPicker } from './veckaPicker.js';
import { toast } from '../ui/toast.js';

const SLOT_EMOJI = { dog: '🐕', cook: '🍳' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function render(container) {
  const s = getState();
  container.innerHTML = '';

  const member = memberById(s.identity);
  const todayW = currentWeekId();
  const todayUTC = todayStockholm();

  const header = el('header', 'view-header');
  header.appendChild(el('h1', 'view-title', member ? `Hej ${member.name}!` : 'Hej!'));
  header.appendChild(el('div', 'week-range', `${fmtDayTitle(todayUTC)} · ${fmtWeekLabel(todayW)}`));
  container.appendChild(header);

  // Hem = nu: står appen på en annan vecka växlar vi tillbaka.
  if (s.weekId !== todayW) {
    const sk = el('div', 'skeleton');
    sk.style.height = '200px';
    sk.style.marginTop = '12px';
    container.appendChild(sk);
    queueMicrotask(() => setWeek(todayW));
    return;
  }

  if (!s.family || !s.weekLoaded) {
    for (let i = 0; i < 2; i++) {
      const sk = el('div', 'skeleton');
      sk.style.height = '150px';
      sk.style.marginTop = '12px';
      container.appendChild(sk);
    }
    return;
  }

  const dates = weekDates(todayW);
  const todayStr = isoDateStr(todayUTC);
  const idx = dates.findIndex((d) => isoDateStr(d) === todayStr);
  const dayKey = DAY_KEYS[idx] || 'mon';
  const day = s.week?.days?.[dayKey] || { slots: {} };
  const slots = [...(s.family.slots || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

  const reportNotice = renderReportNotice(s);
  if (reportNotice) container.appendChild(reportNotice);

  // --- Dagens schema ---
  const schemaCard = el('section', 'card day-card today');
  const head = el('div', 'day-head');
  head.appendChild(el('h2', 'card-title', 'Dagens schema'));
  const toWeek = el('button', 'btn-quiet btn-small', 'Hela veckan ›');
  toWeek.dataset.fkey = 'to-week';
  toWeek.addEventListener('click', () => navigate('vecka'));
  head.appendChild(toWeek);
  schemaCard.appendChild(head);

  if (!s.week) {
    const empty = el('div', 'empty-state');
    empty.appendChild(el('p', 'empty-title', 'Veckan är inte planerad än'));
    const actions = el('div', 'empty-actions');
    const plan = el('button', 'btn', 'Planera veckan');
    plan.addEventListener('click', () => navigate('vecka'));
    actions.appendChild(plan);
    empty.appendChild(actions);
    schemaCard.appendChild(empty);
  } else {
    for (const slot of slots) {
      schemaCard.appendChild(renderSlotRow(s, day, dayKey, dates[idx], slot));
    }
  }
  container.appendChild(schemaCard);

  // --- Dina pass idag ---
  if (member && s.week) {
    const mineCard = el('section', 'card');
    mineCard.appendChild(el('h2', 'card-title', 'Dina pass idag'));
    const mine = [];
    for (const slot of slots) {
      if ((day.slots?.[slot.id] || []).includes(member.id)) {
        const dogs = slot.kind === 'dog' ? dogsForSlot(s.family, day, slot.id).map((d) => d.name) : [];
        mine.push(`${SLOT_EMOJI[slot.kind] || ''} ${slot.label}${dogs.length ? ` med ${dogs.join(' & ')}` : ''}`);
      }
    }
    for (const chore of s.week.chores || []) {
      if (!chore.done && (chore.assignees || []).includes(member.id) && (!chore.day || chore.day === dayKey)) {
        mine.push(`🧺 ${chore.label}`);
      }
    }
    if (mine.length === 0) {
      mineCard.appendChild(el('p', 'card-sub', 'Inga pass för dig idag 🎉'));
    } else {
      for (const m of mine) mineCard.appendChild(el('p', 'mine-row', m));
    }

    // Liten titt på morgondagen
    if (idx < 6) {
      const tomorrow = s.week.days?.[DAY_KEYS[idx + 1]] || { slots: {} };
      const tomorrowMine = slots
        .filter((slot) => (tomorrow.slots?.[slot.id] || []).includes(member.id))
        .map((slot) => slot.label.toLowerCase());
      if (tomorrowMine.length) {
        mineCard.appendChild(el('p', 'caption', `I morgon: ${tomorrowMine.join(', ')}`));
      }
    }
    container.appendChild(mineCard);
  }

  // --- Sysslor kvar ---
  const chores = s.week?.chores || [];
  if (chores.length > 0) {
    const open = chores.filter((c) => !c.done);
    const choresCard = el('section', 'card');
    const chead = el('div', 'day-head');
    chead.appendChild(el('h2', 'card-title', 'Sysslor'));
    chead.appendChild(el('span', 'done-count', `${chores.length - open.length}/${chores.length} klara`));
    choresCard.appendChild(chead);
    if (open.length === 0) {
      choresCard.appendChild(el('p', 'card-sub', 'Allt klart – bra jobbat allihop! 🎉'));
    } else {
      for (const chore of open.slice(0, 4)) {
        choresCard.appendChild(renderChoreRow(chore));
      }
      if (open.length > 4) {
        choresCard.appendChild(el('p', 'caption', `+ ${open.length - 4} till…`));
      }
    }
    const all = el('button', 'btn-quiet btn-small', 'Alla sysslor ›');
    all.dataset.fkey = 'to-chores';
    all.addEventListener('click', () => navigate('sysslor'));
    choresCard.appendChild(all);
    container.appendChild(choresCard);
  }
}

function renderReportNotice(s) {
  if (!isInReportWindow() || !s.family?.settings?.jobSeekers) return null;
  const month = currentMonthStr();
  const waiting = s.family.settings.jobSeekers.filter((id) => {
    const doc = s.jobs[id] || data.getCached(data.jobsPath(id));
    return doc && !(doc.reportedMonths || []).includes(month);
  });
  if (waiting.length === 0) return null;
  const names = waiting.map((id) => memberById(id)?.name || id).join(' och ');
  const box = el('section', 'notice');
  box.appendChild(el('p', 'notice-title', 'Dags att aktivitetsrapportera'));
  box.appendChild(el('p', '', `${names}: rapportera senast den 14:e. Allt underlag finns under Jobb.`));
  const btn = el('button', 'btn-quiet btn-small', 'Öppna Jobb ›');
  btn.dataset.fkey = 'to-jobs';
  btn.addEventListener('click', () => navigate('jobb'));
  box.appendChild(btn);
  return box;
}

function renderSlotRow(s, day, dayKey, dateUTC, slot) {
  const ids = day.slots?.[slot.id] || [];
  const slotDogs = slot.kind === 'dog' ? dogsForSlot(s.family, day, slot.id) : [];
  const dogNames = slotDogs.map((d) => d.name);
  const names = ids.map((id) => memberById(id)?.name || id);

  const row = el('button', 'slot-row');
  row.type = 'button';
  row.dataset.fkey = `islot:${slot.id}`;
  row.setAttribute(
    'aria-label',
    `${slot.label}${dogNames.length ? ' med ' + dogNames.join(' och ') : ''}: `
    + `${names.length ? names.join(' och ') : 'ingen vald'}. Ändra`
  );

  const label = el('span', 'slot-label');
  const labelMain = el('span', 'slot-label-main');
  const emoji = el('span', '', slot.kind === 'dog' ? '🐕'.repeat(Math.max(1, Math.min(slotDogs.length, 2))) : (SLOT_EMOJI[slot.kind] || '📌'));
  emoji.setAttribute('aria-hidden', 'true');
  labelMain.append(emoji, el('span', '', slot.shortLabel || slot.label));
  label.appendChild(labelMain);
  if (dogNames.length) {
    const sub = el('span', 'slot-dogs', dogNames.join(' + '));
    sub.setAttribute('aria-hidden', 'true');
    label.appendChild(sub);
  }
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
  return row;
}

function renderChoreRow(chore) {
  const row = el('div', 'chore-row');
  const check = el('button', 'chore-check');
  check.dataset.fkey = `ichore:${chore.id}`;
  check.setAttribute('role', 'checkbox');
  check.setAttribute('aria-checked', 'false');
  check.setAttribute('aria-label', `Markera ${chore.label} som klar`);
  const box = el('span', 'box');
  box.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
  check.appendChild(box);
  check.addEventListener('click', () => {
    mutateWeek(mutChoreToggle({
      weekId: getState().weekId,
      choreId: chore.id,
      choreLabel: chore.label,
      done: true,
      actorName: currentActor().name,
    })).catch(() => toast('Kunde inte spara – kontrollera nätet och försök igen'));
  });
  row.appendChild(check);

  const main = el('span', 'chore-main');
  main.appendChild(el('span', 'chore-label', chore.label));
  row.appendChild(main);
  return row;
}
