// ISO-veckomatte och svensk datumformatering. Alla "dagar" representeras som
// UTC-midnattsdatum för kalenderdagen i Europe/Stockholm — då blir aritmetiken
// immun mot enhetens tidszon och sommartid.
const TZ = 'Europe/Stockholm';

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const DAY_LABELS = {
  mon: 'måndag', tue: 'tisdag', wed: 'onsdag', thu: 'torsdag',
  fri: 'fredag', sat: 'lördag', sun: 'söndag',
};

export const DAY_LABELS_SHORT = {
  mon: 'mån', tue: 'tis', wed: 'ons', thu: 'tors', fri: 'fre', sat: 'lör', sun: 'sön',
};

// Kalenderdagen i Stockholm just nu, som UTC-midnattsdatum.
export function todayStockholm(now = new Date()) {
  const str = now.toLocaleDateString('sv-SE', { timeZone: TZ }); // "2026-08-09"
  return new Date(str + 'T00:00:00Z');
}

// ISO 8601: veckan tillhör det år där dess torsdag ligger.
export function isoWeekId(dateUTC) {
  const d = new Date(Date.UTC(dateUTC.getUTCFullYear(), dateUTC.getUTCMonth(), dateUTC.getUTCDate()));
  const day = d.getUTCDay() || 7; // mån=1 ... sön=7
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d - jan1) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function parseWeekId(weekId) {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekId);
  if (!m) throw new Error('Ogiltigt vecko-id: ' + weekId);
  return { year: Number(m[1]), week: Number(m[2]) };
}

// Måndagen i en given ISO-vecka. ISO-vecka 1 innehåller alltid 4 januari.
export function mondayOfWeek(weekId) {
  const { year, week } = parseWeekId(weekId);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const d = new Date(jan4);
  d.setUTCDate(jan4.getUTCDate() - (day - 1) + (week - 1) * 7);
  return d;
}

export function addWeeks(weekId, n) {
  const d = mondayOfWeek(weekId);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return isoWeekId(d);
}

export function weekDates(weekId) {
  const mon = mondayOfWeek(weekId);
  return DAY_KEYS.map((_, i) => {
    const d = new Date(mon);
    d.setUTCDate(mon.getUTCDate() + i);
    return d;
  });
}

export function currentWeekId(now = new Date()) {
  return isoWeekId(todayStockholm(now));
}

export function isoDateStr(dateUTC) {
  return dateUTC.toISOString().slice(0, 10);
}

export function weekIdOfDateStr(dateStr) {
  return isoWeekId(new Date(dateStr + 'T00:00:00Z'));
}

// --- Formatering (sv-SE). Datumen är UTC-midnatt, därav timeZone: 'UTC'. ---

const longFmt = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const shortFmt = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const weekdayFmt = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', timeZone: 'UTC' });
const monthOnlyFmt = new Intl.DateTimeFormat('sv-SE', { month: 'long', timeZone: 'UTC' });

export function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function fmtWeekLabel(weekId) {
  return 'v. ' + parseWeekId(weekId).week;
}

// "10–16 augusti", "31 augusti – 6 september", med " · 2027" om annat år än nu.
export function fmtWeekRange(weekId, now = new Date()) {
  const days = weekDates(weekId);
  const first = days[0];
  const last = days[6];
  let range;
  if (first.getUTCMonth() === last.getUTCMonth()) {
    range = `${first.getUTCDate()}–${longFmt.format(last)}`;
  } else {
    range = `${longFmt.format(first)} – ${longFmt.format(last)}`;
  }
  const thisYear = todayStockholm(now).getUTCFullYear();
  const weekYear = parseWeekId(weekId).year;
  return weekYear === thisYear ? range : `${range} · ${weekYear}`;
}

// "Måndag 10 aug"
export function fmtDayTitle(dateUTC) {
  const short = shortFmt.format(dateUTC).replace(/\.$/, '');
  return `${capitalize(weekdayFmt.format(dateUTC))} ${short}`;
}

// "10 aug"
export function fmtShortDate(dateStr) {
  if (!dateStr) return '';
  return shortFmt.format(new Date(dateStr + 'T00:00:00Z')).replace(/\.$/, '');
}

export function monthNameOf(monthStr) {
  return monthOnlyFmt.format(new Date(monthStr + '-01T00:00:00Z'));
}

// "2026-08" för Stockholm-månaden just nu, samt föregående månad.
export function currentMonthStr(now = new Date()) {
  return isoDateStr(todayStockholm(now)).slice(0, 7);
}

export function prevMonthStr(now = new Date()) {
  const d = todayStockholm(now);
  d.setUTCDate(1);
  d.setUTCDate(0); // sista dagen i föregående månad
  return isoDateStr(d).slice(0, 7);
}

// Aktivitetsrapport-fönstret: den 1–14 varje månad.
export function isInReportWindow(now = new Date()) {
  return todayStockholm(now).getUTCDate() <= 14;
}

export function dayOfMonthStockholm(now = new Date()) {
  return todayStockholm(now).getUTCDate();
}

// "för 2 timmar sedan", "i går", "nyss"
const relFmt = new Intl.RelativeTimeFormat('sv', { numeric: 'auto' });

export function relativeTime(isoString, now = new Date()) {
  const then = new Date(isoString);
  const diffSec = Math.round((then - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return 'nyss';
  if (abs < 3600) return relFmt.format(Math.trunc(diffSec / 60), 'minute');
  if (abs < 86400) return relFmt.format(Math.trunc(diffSec / 3600), 'hour');
  if (abs < 86400 * 14) return relFmt.format(Math.trunc(diffSec / 86400), 'day');
  return shortFmt.format(then).replace(/\.$/, '') + (then.getUTCFullYear() !== now.getUTCFullYear() ? ' ' + then.getUTCFullYear() : '');
}
