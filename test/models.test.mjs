// Enhetstester för datamodeller och mutationer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyWeek, normalizeWeek, emptyJobs, normalizeJobs, randomId,
  mutSetSlot, mutCopyWeekFrom, mutChoreAdd, mutChoreToggle, mutChoreDelete,
  mutJobsToggleStep, mutJobsAddApplication, mutJobsUpdateApplication, mutJobsMarkReported,
} from '../js/models.js';

test('emptyWeek har alla sju dagar', () => {
  const w = emptyWeek('2026-W33');
  assert.equal(Object.keys(w.days).length, 7);
  assert.deepEqual(w.days.mon, { note: '', slots: {} });
  assert.equal(w.week, '2026-W33');
});

test('normalizeWeek reparerar ofullständiga dokument', () => {
  const w = normalizeWeek({ days: { mon: { slots: { 'hund-morgon': ['ebba'] } } } }, '2026-W33');
  assert.deepEqual(w.days.mon.slots['hund-morgon'], ['ebba']);
  assert.deepEqual(w.days.sun, { note: '', slots: {} });
  assert.deepEqual(w.chores, []);
  assert.equal(normalizeWeek(null, '2026-W33').week, '2026-W33');
});

test('mutSetSlot sätter och rensar pass, med svenskt commit-meddelande', () => {
  const doc = emptyWeek('2026-W33');
  const mut = mutSetSlot({
    weekId: '2026-W33', dayKey: 'tue', dayLabelShort: 'tis',
    slotId: 'hund-morgon', slotLabel: 'Morgonpromenad',
    memberIds: ['ebba', 'felix'], memberNames: ['Ebba', 'Felix'], actorName: 'Jenny',
  });
  mut.apply(doc);
  assert.deepEqual(doc.days.tue.slots['hund-morgon'], ['ebba', 'felix']);
  assert.equal(mut.message, 'v33 2026: Morgonpromenad tis: Ebba + Felix (ändrat av Jenny)');

  const clear = mutSetSlot({
    weekId: '2026-W33', dayKey: 'tue', dayLabelShort: 'tis',
    slotId: 'hund-morgon', slotLabel: 'Morgonpromenad',
    memberIds: [], memberNames: [], actorName: 'Jenny',
  });
  clear.apply(doc);
  assert.deepEqual(doc.days.tue.slots['hund-morgon'], []);
  assert.match(clear.message, /rensad/);
});

test('mutSetSlot fungerar även på trasigt dokument (replay efter konflikt)', () => {
  const doc = { week: '2026-W33' }; // saknar days helt
  mutSetSlot({
    weekId: '2026-W33', dayKey: 'fri', dayLabelShort: 'fre',
    slotId: 'matlagning', slotLabel: 'Middag',
    memberIds: ['andreas'], memberNames: ['Andreas'], actorName: 'Andreas',
  }).apply(doc);
  assert.deepEqual(doc.days.fri.slots['matlagning'], ['andreas']);
});

test('mutCopyWeekFrom kopierar pass och nollställer sysslors klar-status', () => {
  const from = emptyWeek('2026-W33');
  from.days.mon.slots['hund-morgon'] = ['kasper'];
  from.chores = [{ id: 'abcd', label: 'Handla mat', assignees: ['jenny'], day: null, done: true }];
  const doc = emptyWeek('2026-W34');
  const mut = mutCopyWeekFrom({ weekId: '2026-W34', fromWeekId: '2026-W33', fromDoc: from, actorName: 'Felix' });
  mut.apply(doc);
  assert.deepEqual(doc.days.mon.slots['hund-morgon'], ['kasper']);
  assert.equal(doc.chores.length, 1);
  assert.equal(doc.chores[0].done, false);
  assert.equal(doc.chores[0].label, 'Handla mat');
  assert.notEqual(doc.chores[0].id, 'abcd'); // nytt id i nya veckan
  assert.equal(mut.message, 'v34 2026: schema kopierat från v33 2026 (ändrat av Felix)');
  // Kopian är djup — ändring i nya veckan läcker inte tillbaka
  doc.days.mon.slots['hund-morgon'].push('ebba');
  assert.deepEqual(from.days.mon.slots['hund-morgon'], ['kasper']);
});

test('sysslomutationer: lägg till, bocka av, ta bort — idempotent add', () => {
  const doc = emptyWeek('2026-W33');
  const chore = { id: 'ab12', label: 'Tvätt', assignees: [], day: null, done: false };
  const add = mutChoreAdd({ weekId: '2026-W33', chore, actorName: 'Ebba' });
  add.apply(doc);
  add.apply(doc); // replay ska inte dubblera
  assert.equal(doc.chores.length, 1);

  mutChoreToggle({ weekId: '2026-W33', choreId: 'ab12', choreLabel: 'Tvätt', done: true, actorName: 'Ebba' }).apply(doc);
  assert.equal(doc.chores[0].done, true);

  mutChoreDelete({ weekId: '2026-W33', choreId: 'ab12', choreLabel: 'Tvätt', actorName: 'Ebba' }).apply(doc);
  assert.equal(doc.chores.length, 0);
});

test('jobbmutationer: checklista, rapport och ansökningar', () => {
  const doc = emptyJobs('kasper');
  mutJobsToggleStep({ member: 'kasper', stepId: 'skriv-in', stepTitle: 'Skriv in dig', done: true, doneDate: '2026-08-09', actorName: 'Kasper' }).apply(doc);
  assert.equal(doc.checklist['skriv-in'], '2026-08-09');
  mutJobsToggleStep({ member: 'kasper', stepId: 'skriv-in', stepTitle: 'Skriv in dig', done: false, actorName: 'Kasper' }).apply(doc);
  assert.equal('skriv-in' in doc.checklist, false);

  const rep = mutJobsMarkReported({ member: 'kasper', month: '2026-08', monthName: 'augusti', actorName: 'Kasper' });
  rep.apply(doc);
  rep.apply(doc); // idempotent
  assert.deepEqual(doc.reportedMonths, ['2026-08']);

  const app = { id: 'a1', company: 'ICA Maxi', role: 'Butik', date: '2026-08-09', status: 'sokt', url: '', notes: '' };
  const add = mutJobsAddApplication({ member: 'kasper', application: app, actorName: 'Kasper' });
  add.apply(doc);
  add.apply(doc);
  assert.equal(doc.applications.length, 1);
  assert.equal(add.message, 'jobb kasper: ny ansökan – ICA Maxi (Butik) (ändrat av Kasper)');

  const upd = mutJobsUpdateApplication({ member: 'kasper', application: { ...app, status: 'intervju' }, statusChanged: true, actorName: 'Kasper' });
  upd.apply(doc);
  assert.equal(doc.applications[0].status, 'intervju');
  assert.match(upd.message, /→ Intervju/);
});

test('normalizeJobs och randomId', () => {
  const j = normalizeJobs({ weeklyGoal: 'fel' }, 'felix');
  assert.equal(j.weeklyGoal, 5);
  assert.equal(j.member, 'felix');
  const id = randomId(6);
  assert.match(id, /^[a-z0-9]{6}$/);
  assert.notEqual(randomId(6), randomId(6));
});
