// Enhetstester för datamodeller och mutationer.
// OBS: endast fiktiva namn (samma som dev-datat) — riktiga namn får aldrig
// förekomma i detta publika repo.
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
  const w = normalizeWeek({ days: { mon: { slots: { 'hund-morgon': ['anna'] } } } }, '2026-W33');
  assert.deepEqual(w.days.mon.slots['hund-morgon'], ['anna']);
  assert.deepEqual(w.days.sun, { note: '', slots: {} });
  assert.deepEqual(w.chores, []);
  assert.equal(normalizeWeek(null, '2026-W33').week, '2026-W33');
});

test('mutSetSlot sätter och rensar pass, med svenskt commit-meddelande', () => {
  const doc = emptyWeek('2026-W33');
  const mut = mutSetSlot({
    weekId: '2026-W33', dayKey: 'tue', dayLabelShort: 'tis',
    slotId: 'hund-morgon', slotLabel: 'Morgonpromenad',
    memberIds: ['elsa', 'david'], memberNames: ['Elsa', 'David'], actorName: 'Bosse',
  });
  mut.apply(doc);
  assert.deepEqual(doc.days.tue.slots['hund-morgon'], ['elsa', 'david']);
  assert.equal(mut.message, 'v33 2026: Morgonpromenad tis: Elsa + David (ändrat av Bosse)');

  const clear = mutSetSlot({
    weekId: '2026-W33', dayKey: 'tue', dayLabelShort: 'tis',
    slotId: 'hund-morgon', slotLabel: 'Morgonpromenad',
    memberIds: [], memberNames: [], actorName: 'Bosse',
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
    memberIds: ['bosse'], memberNames: ['Bosse'], actorName: 'Bosse',
  }).apply(doc);
  assert.deepEqual(doc.days.fri.slots['matlagning'], ['bosse']);
});

test('mutCopyWeekFrom kopierar pass, nollställer klar-status och är deterministisk vid replay', () => {
  const from = emptyWeek('2026-W33');
  from.days.mon.slots['hund-morgon'] = ['cilla'];
  from.chores = [{ id: 'abcd', label: 'Handla mat', assignees: ['bosse'], day: null, done: true }];
  const doc = emptyWeek('2026-W34');
  const mut = mutCopyWeekFrom({ weekId: '2026-W34', fromWeekId: '2026-W33', fromDoc: from, actorName: 'David' });
  mut.apply(doc);
  assert.deepEqual(doc.days.mon.slots['hund-morgon'], ['cilla']);
  assert.equal(doc.chores.length, 1);
  assert.equal(doc.chores[0].done, false);
  assert.equal(doc.chores[0].label, 'Handla mat');
  assert.notEqual(doc.chores[0].id, 'abcd'); // nytt id i nya veckan
  assert.equal(mut.message, 'v34 2026: schema kopierat från v33 2026 (ändrat av David)');

  // apply() måste vara deterministisk: förhandsvisning, sparning och
  // konflikt-replay ska ge exakt samma syssle-id:n.
  const doc2 = emptyWeek('2026-W34');
  mut.apply(doc2);
  assert.equal(doc2.chores[0].id, doc.chores[0].id);

  // Kopian är djup — ändring i nya veckan läcker inte tillbaka
  doc.days.mon.slots['hund-morgon'].push('anna');
  assert.deepEqual(from.days.mon.slots['hund-morgon'], ['cilla']);
  doc.chores[0].done = true;
  mut.apply(doc2);
  assert.equal(doc2.chores[0].done, false);
});

test('sysslomutationer: lägg till, bocka av, ta bort — idempotent add', () => {
  const doc = emptyWeek('2026-W33');
  const chore = { id: 'ab12', label: 'Tvätt', assignees: [], day: null, done: false };
  const add = mutChoreAdd({ weekId: '2026-W33', chore, actorName: 'Elsa' });
  add.apply(doc);
  add.apply(doc); // replay ska inte dubblera
  assert.equal(doc.chores.length, 1);

  mutChoreToggle({ weekId: '2026-W33', choreId: 'ab12', choreLabel: 'Tvätt', done: true, actorName: 'Elsa' }).apply(doc);
  assert.equal(doc.chores[0].done, true);

  mutChoreDelete({ weekId: '2026-W33', choreId: 'ab12', choreLabel: 'Tvätt', actorName: 'Elsa' }).apply(doc);
  assert.equal(doc.chores.length, 0);
});

test('jobbmutationer: checklista, rapport och ansökningar', () => {
  const doc = emptyJobs('cilla');
  mutJobsToggleStep({ member: 'cilla', stepId: 'skriv-in', stepTitle: 'Skriv in dig', done: true, doneDate: '2026-08-09', actorName: 'Cilla' }).apply(doc);
  assert.equal(doc.checklist['skriv-in'], '2026-08-09');
  mutJobsToggleStep({ member: 'cilla', stepId: 'skriv-in', stepTitle: 'Skriv in dig', done: false, actorName: 'Cilla' }).apply(doc);
  assert.equal('skriv-in' in doc.checklist, false);

  const rep = mutJobsMarkReported({ member: 'cilla', month: '2026-08', monthName: 'augusti', actorName: 'Cilla' });
  rep.apply(doc);
  rep.apply(doc); // idempotent
  assert.deepEqual(doc.reportedMonths, ['2026-08']);

  const app = { id: 'a1', company: 'ICA Maxi', role: 'Butik', date: '2026-08-09', status: 'sokt', url: '', notes: '' };
  const add = mutJobsAddApplication({ member: 'cilla', application: app, actorName: 'Cilla' });
  add.apply(doc);
  add.apply(doc);
  assert.equal(doc.applications.length, 1);
  assert.equal(add.message, 'jobb cilla: ny ansökan – ICA Maxi (Butik) (ändrat av Cilla)');

  const upd = mutJobsUpdateApplication({ member: 'cilla', application: { ...app, status: 'intervju' }, statusChanged: true, actorName: 'Cilla' });
  upd.apply(doc);
  assert.equal(doc.applications[0].status, 'intervju');
  assert.match(upd.message, /→ Intervju/);
});

test('normalizeJobs och randomId', () => {
  const j = normalizeJobs({ weeklyGoal: 'fel' }, 'david');
  assert.equal(j.weeklyGoal, 5);
  assert.equal(j.member, 'david');
  const id = randomId(6);
  assert.match(id, /^[a-z0-9]{6}$/);
  assert.notEqual(randomId(6), randomId(6));
});
