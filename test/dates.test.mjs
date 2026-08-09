// Enhetstester för ISO-veckomatte och formatering.
// Kör: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isoWeekId, parseWeekId, mondayOfWeek, addWeeks, weekDates,
  todayStockholm, currentWeekId, isoDateStr, weekIdOfDateStr,
  fmtWeekLabel, fmtWeekRange, fmtDayTitle, prevMonthStr, currentMonthStr,
  isInReportWindow, relativeTime, DAY_KEYS,
} from '../js/dates.js';

const utc = (s) => new Date(s + 'T00:00:00Z');

test('isoWeekId: grundfall augusti 2026', () => {
  assert.equal(isoWeekId(utc('2026-08-09')), '2026-W32'); // söndag
  assert.equal(isoWeekId(utc('2026-08-10')), '2026-W33'); // måndag
  assert.equal(isoWeekId(utc('2026-08-16')), '2026-W33'); // söndag
});

test('2026 har 53 ISO-veckor (1 jan 2026 är en torsdag)', () => {
  assert.equal(isoWeekId(utc('2026-12-28')), '2026-W53'); // måndag i v53
  assert.equal(isoWeekId(utc('2027-01-03')), '2026-W53'); // söndag i v53
  assert.equal(isoWeekId(utc('2027-01-01')), '2026-W53'); // fredag → förra årets v53
  assert.equal(isoWeekId(utc('2027-01-04')), '2027-W01');
});

test('årsskiften åt andra hållet: januaridagar i föregående års vecka', () => {
  assert.equal(isoWeekId(utc('2025-12-29')), '2026-W01'); // måndag → nästa års v1
  assert.equal(isoWeekId(utc('2026-01-01')), '2026-W01');
  assert.equal(isoWeekId(utc('2024-12-31')), '2025-W01');
  assert.equal(isoWeekId(utc('2023-01-01')), '2022-W52'); // söndag → förra årets v52
});

test('addWeeks navigerar över 53-veckorsgränsen', () => {
  assert.equal(addWeeks('2026-W52', 1), '2026-W53');
  assert.equal(addWeeks('2026-W53', 1), '2027-W01');
  assert.equal(addWeeks('2027-W01', -1), '2026-W53');
  assert.equal(addWeeks('2026-W01', -1), '2025-W52');
});

test('mondayOfWeek och weekDates', () => {
  assert.equal(isoDateStr(mondayOfWeek('2026-W33')), '2026-08-10');
  assert.equal(isoDateStr(mondayOfWeek('2026-W01')), '2025-12-29');
  const days = weekDates('2026-W33');
  assert.equal(days.length, 7);
  assert.equal(isoDateStr(days[0]), '2026-08-10');
  assert.equal(isoDateStr(days[6]), '2026-08-16');
  assert.equal(DAY_KEYS.length, 7);
});

test('varje vecko-id är rundresesäkert: mondayOfWeek → isoWeekId', () => {
  for (const w of ['2024-W09', '2025-W52', '2026-W01', '2026-W33', '2026-W53', '2027-W01', '2030-W26']) {
    assert.equal(isoWeekId(mondayOfWeek(w)), w);
  }
});

test('todayStockholm och currentWeekId följer Stockholm, inte enhetens tidszon', () => {
  // 2026-08-09 23:30 UTC = 2026-08-10 01:30 i Stockholm (sommartid) → v33
  const lateSunday = new Date('2026-08-09T23:30:00Z');
  assert.equal(isoDateStr(todayStockholm(lateSunday)), '2026-08-10');
  assert.equal(currentWeekId(lateSunday), '2026-W33');
  // Vintertid: 2026-12-31 23:30 UTC = 2027-01-01 00:30 i Stockholm → fortfarande 2026-W53
  const newYear = new Date('2026-12-31T23:30:00Z');
  assert.equal(isoDateStr(todayStockholm(newYear)), '2027-01-01');
  assert.equal(currentWeekId(newYear), '2026-W53');
});

test('weekIdOfDateStr för ansökningsdatum', () => {
  assert.equal(weekIdOfDateStr('2026-08-14'), '2026-W33');
  assert.equal(weekIdOfDateStr('2026-08-09'), '2026-W32');
});

test('formatering på svenska', () => {
  assert.equal(fmtWeekLabel('2026-W33'), 'v. 33');
  assert.equal(fmtWeekRange('2026-W33', new Date('2026-08-09T12:00:00Z')), '10–16 augusti');
  // Vecka som spänner över månadsskifte
  assert.equal(fmtWeekRange('2026-W36', new Date('2026-08-09T12:00:00Z')), '31 augusti – 6 september');
  // Annat år → årssuffix
  assert.match(fmtWeekRange('2027-W02', new Date('2026-08-09T12:00:00Z')), /· 2027$/);
  assert.match(fmtDayTitle(utc('2026-08-10')), /^Måndag 10 aug/);
});

test('månadssträngar och rapportfönstret', () => {
  const d = new Date('2026-08-09T12:00:00Z');
  assert.equal(currentMonthStr(d), '2026-08');
  assert.equal(prevMonthStr(d), '2026-07');
  assert.equal(prevMonthStr(new Date('2026-01-05T12:00:00Z')), '2025-12');
  assert.equal(isInReportWindow(new Date('2026-08-14T12:00:00Z')), true);
  assert.equal(isInReportWindow(new Date('2026-08-15T12:00:00Z')), false);
});

test('relativeTime på svenska', () => {
  const now = new Date('2026-08-09T12:00:00Z');
  assert.equal(relativeTime('2026-08-09T11:59:40Z', now), 'nyss');
  assert.match(relativeTime('2026-08-09T11:30:00Z', now), /30 minuter/);
  assert.match(relativeTime('2026-08-09T09:00:00Z', now), /3 timmar/);
  assert.match(relativeTime('2026-08-08T10:00:00Z', now), /i går|1 dag/);
});
