// Idag — hemvyn: hälsning, dagens schema, dina pass, sysslor och
// rapportpåminnelse. Visar alltid innevarande vecka.
import { getState, setState } from '../store.js';
import { setWeek, mutateWeek, currentActor, memberById } from '../controller.js';
import { navigate } from '../router.js';
import * as data from '../data.js';
import {
  DAY_KEYS, DAY_LABELS_SHORT, weekDates, currentWeekId, isoDateStr, todayStockholm,
  fmtDayTitle, fmtWeekLabel, isInReportWindow, currentMonthStr, monthNameOf,
  weeksOverlappingMonth,
} from '../dates.js';
import { displaySlots, slotDogs, slotTimeFor, mutChoreToggle, countDogWalksForMonth } from '../models.js';
import { buildSlotRow } from './vecka.js';
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
  const daySlots = displaySlots(s.family, day);

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
    for (const slot of daySlots) {
      schemaCard.appendChild(buildSlotRow(s, day, dayKey, dates[idx], slot, 'islot:'));
    }
  }
  container.appendChild(schemaCard);

  // --- Dina pass idag ---
  if (member && s.week) {
    const mineCard = el('section', 'card');
    mineCard.appendChild(el('h2', 'card-title', 'Dina pass idag'));
    const mine = [];
    for (const slot of daySlots) {
      if ((day.slots?.[slot.id] || []).includes(member.id)) {
        const dogs = slotDogs(s.family, slot).map((d) => d.name);
        const time = slot.timeChoice ? ` (${(s.family.slots.find((x) => x.id === slotTimeFor(slot, day))?.shortLabel || '').toLowerCase()})` : '';
        mine.push(`${SLOT_EMOJI[slot.kind] || ''} ${slot.label}${time}${dogs.length && !slot.timeChoice ? ` med ${dogs.join(' & ')}` : ''}`);
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
      const tomorrowMine = displaySlots(s.family, tomorrow)
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

  container.appendChild(renderMonthCard(s));
}

// --- Månadens hundpass: alla fem delar lika, avstämt per månad ---
// 28 pass i veckan går inte jämnt upp på fem personer, så rättvisan följs
// upp över hela månaden i stället.

const monthFetchState = new Map(); // weekPath -> 'pending' | 'done'

function renderMonthCard(s) {
  const month = currentMonthStr();
  const weeks = weeksOverlappingMonth(month);

  const weekDocs = {};
  let missing = 0;
  for (const w of weeks) {
    const path = data.weekPath(w);
    const doc = w === s.weekId ? s.week : data.getCached(path);
    weekDocs[w] = doc;
    if (!doc && monthFetchState.get(path) !== 'done') {
      missing++;
      if (!monthFetchState.has(path)) {
        monthFetchState.set(path, 'pending');
        data.refresh(path)
          .catch(() => {})
          .finally(() => {
            monthFetchState.set(path, 'done');
            setState({}); // rita om när fler veckor räknats in
          });
      }
    }
  }

  const counts = countDogWalksForMonth(s.family, weekDocs, month);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const avg = total / Math.max(1, s.family.members.length);
  const values = Object.values(counts);
  const spread = values.length ? Math.max(...values) - Math.min(...values) : 0;

  const card = el('section', 'card');
  const head = el('div', 'day-head');
  head.appendChild(el('h2', 'card-title', `Hundpassen i ${monthNameOf(month)}`));
  head.appendChild(el('span', 'done-count', `${total} pass`));
  card.appendChild(head);

  const row = el('div', 'week-loads');
  row.style.justifyContent = 'flex-start';
  for (const m of s.family.members) {
    const count = counts[m.id];
    // Avvikelse mot snittet hittills i månaden — så syns direkt vem som
    // ligger före eller efter, utan huvudräkning.
    const delta = Math.round(count - avg);
    const showDelta = total > 0 && delta !== 0;
    const chip = el('span', 'load-chip' + (count === 0 ? ' dim' : ''));
    chip.setAttribute('role', 'img');
    chip.setAttribute('aria-label',
      `${m.name}: ${count} hundpass i ${monthNameOf(month)}`
      + (showDelta ? `, ${Math.abs(delta)} ${delta > 0 ? 'över' : 'under'} snittet` : ''));
    const av = el('span', 'avatar', m.initial);
    av.style.setProperty('--member-color', m.color);
    av.style.width = '26px';
    av.style.height = '26px';
    av.style.fontSize = '12px';
    av.setAttribute('aria-hidden', 'true');
    chip.append(av, el('span', '', String(count)));
    if (showDelta) {
      const d = el('span', 'load-delta', (delta > 0 ? '+' : '−') + Math.abs(delta));
      d.setAttribute('aria-hidden', 'true');
      chip.appendChild(d);
    }
    row.appendChild(chip);
  }
  card.appendChild(row);

  // Mjuk signal — bara när spridningen blivit stor på riktigt (> 8 pass,
  // motsvarande två hela dagar). Ingen pekas ut; siffrorna talar själva.
  let captionText;
  if (missing > 0) {
    captionText = 'Räknar ihop månadens alla veckor…';
  } else if (spread > 8) {
    captionText = 'Det skiljer en del just nu — snegla på fördelningen när ni planerar nästa vecka.';
  } else {
    captionText = 'Fyra hundpass om dagen — målet är att alla ligger ungefär lika när månaden är slut.';
  }
  const caption = el('p', 'caption', captionText);
  if (missing === 0 && spread > 8) caption.className = 'caption caption-warn';
  card.appendChild(caption);
  return card;
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
