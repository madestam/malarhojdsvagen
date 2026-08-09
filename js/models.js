// Datamodeller: tomma dokument, normalisering och mutationsfabriker.
// En mutation = { apply(doc), message } — apply körs om på färsk data vid
// konflikt, och message blir git-commitmeddelandet i datarepot.
import { DAY_KEYS, parseWeekId } from './dates.js';

export const APPLICATION_STATUSES = [
  { id: 'att-soka',   label: 'Att söka' },
  { id: 'sokt',       label: 'Sökt' },
  { id: 'intervju',   label: 'Intervju' },
  { id: 'nej-tack',   label: 'Nej tack' },
  { id: 'erbjudande', label: 'Erbjudande!' },
];

export function statusLabel(id) {
  const s = APPLICATION_STATUSES.find((x) => x.id === id);
  return s ? s.label : id;
}

export function randomId(len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const arr = new Uint8Array(len);
  globalThis.crypto.getRandomValues(arr);
  return [...arr].map((b) => chars[b % 36]).join('');
}

// --- Tomma dokument och normalisering (tål handredigerad/ofullständig JSON) ---

export function emptyWeek(weekId) {
  return {
    version: 1,
    week: weekId,
    note: '',
    days: Object.fromEntries(DAY_KEYS.map((k) => [k, { note: '', slots: {} }])),
    chores: [],
    updatedAt: null,
    updatedBy: null,
  };
}

export function normalizeWeek(doc, weekId) {
  const base = emptyWeek(weekId);
  if (!doc || typeof doc !== 'object') return base;
  const out = { ...base, ...doc, week: weekId };
  out.days = { ...base.days };
  for (const k of DAY_KEYS) {
    const day = doc.days && doc.days[k];
    out.days[k] = {
      note: (day && typeof day.note === 'string') ? day.note : '',
      slots: (day && day.slots && typeof day.slots === 'object') ? { ...day.slots } : {},
    };
  }
  out.chores = Array.isArray(doc.chores) ? doc.chores.map((c) => ({ ...c })) : [];
  return out;
}

export function emptyJobs(memberId) {
  return {
    version: 1,
    member: memberId,
    weeklyGoal: 5,
    reportedMonths: [],
    checklist: {},
    applications: [],
  };
}

export function normalizeJobs(doc, memberId) {
  const base = emptyJobs(memberId);
  if (!doc || typeof doc !== 'object') return base;
  return {
    ...base,
    ...doc,
    member: memberId,
    weeklyGoal: Number.isFinite(doc.weeklyGoal) ? doc.weeklyGoal : base.weeklyGoal,
    reportedMonths: Array.isArray(doc.reportedMonths) ? [...doc.reportedMonths] : [],
    checklist: (doc.checklist && typeof doc.checklist === 'object') ? { ...doc.checklist } : {},
    applications: Array.isArray(doc.applications) ? doc.applications.map((a) => ({ ...a })) : [],
  };
}

// --- Hjälpare för commit-meddelanden ---

function weekPrefix(weekId) {
  const { year, week } = parseWeekId(weekId);
  return `v${week} ${year}`;
}

function by(actorName) {
  return `(ändrat av ${actorName})`;
}

function ensureDay(doc, dayKey) {
  if (!doc.days) doc.days = {};
  if (!doc.days[dayKey]) doc.days[dayKey] = { note: '', slots: {} };
  if (!doc.days[dayKey].slots) doc.days[dayKey].slots = {};
  return doc.days[dayKey];
}

// --- Veckomutationer ---

export function mutSetSlot({ weekId, dayKey, dayLabelShort, slotId, slotLabel, memberIds, memberNames, actorName }) {
  const what = memberNames.length
    ? `${slotLabel} ${dayLabelShort}: ${memberNames.join(' + ')}`
    : `${slotLabel} ${dayLabelShort} rensad`;
  return {
    apply(doc) {
      ensureDay(doc, dayKey).slots[slotId] = [...memberIds];
    },
    message: `${weekPrefix(weekId)}: ${what} ${by(actorName)}`,
  };
}

export function mutSetWeekNote({ weekId, note, actorName }) {
  return {
    apply(doc) {
      doc.note = note;
    },
    message: `${weekPrefix(weekId)}: veckans anteckning uppdaterad ${by(actorName)}`,
  };
}

export function mutCopyWeekFrom({ weekId, fromWeekId, fromDoc, actorName }) {
  // Nya syssle-id:n bestäms EN gång här i fabriken — apply() körs flera
  // gånger (förhandsvisning, sparning, konflikt-omförsök) och måste ge
  // exakt samma resultat varje gång, annars pekar köade uppföljnings-
  // mutationer på id:n som aldrig sparades.
  const copiedChores = (fromDoc.chores || []).map((c) => ({ ...c, id: randomId(4), done: false }));
  return {
    apply(doc) {
      for (const k of DAY_KEYS) {
        const fromSlots = (fromDoc.days && fromDoc.days[k] && fromDoc.days[k].slots) || {};
        ensureDay(doc, k).slots = Object.fromEntries(
          Object.entries(fromSlots).map(([slotId, ids]) => [slotId, [...ids]])
        );
      }
      doc.chores = copiedChores.map((c) => ({ ...c }));
    },
    message: `${weekPrefix(weekId)}: schema kopierat från ${weekPrefix(fromWeekId)} ${by(actorName)}`,
  };
}

export function mutChoreAdd({ weekId, chore, actorName, restored = false }) {
  return {
    apply(doc) {
      if (!Array.isArray(doc.chores)) doc.chores = [];
      if (!doc.chores.some((c) => c.id === chore.id)) doc.chores.push({ ...chore });
    },
    message: `${weekPrefix(weekId)}: ${restored ? `syssla "${chore.label}" återställd` : `ny syssla "${chore.label}"`} ${by(actorName)}`,
  };
}

export function mutChoreToggle({ weekId, choreId, choreLabel, done, actorName }) {
  return {
    apply(doc) {
      const c = (doc.chores || []).find((x) => x.id === choreId);
      if (c) c.done = done;
    },
    message: `${weekPrefix(weekId)}: "${choreLabel}" ${done ? 'klar ✓' : 'åter öppen'} ${by(actorName)}`,
  };
}

export function mutChoreUpdate({ weekId, chore, actorName }) {
  return {
    apply(doc) {
      const i = (doc.chores || []).findIndex((x) => x.id === chore.id);
      if (i >= 0) doc.chores[i] = { ...doc.chores[i], ...chore };
    },
    message: `${weekPrefix(weekId)}: syssla "${chore.label}" ändrad ${by(actorName)}`,
  };
}

export function mutChoreDelete({ weekId, choreId, choreLabel, actorName }) {
  return {
    apply(doc) {
      doc.chores = (doc.chores || []).filter((x) => x.id !== choreId);
    },
    message: `${weekPrefix(weekId)}: syssla "${choreLabel}" borttagen ${by(actorName)}`,
  };
}

// --- Jobbmutationer (path: jobs/<member>.json) ---

export function mutJobsToggleStep({ member, stepId, stepTitle, done, doneDate, actorName }) {
  return {
    apply(doc) {
      if (!doc.checklist || typeof doc.checklist !== 'object') doc.checklist = {};
      if (done) doc.checklist[stepId] = doneDate;
      else delete doc.checklist[stepId];
    },
    message: `jobb ${member}: "${stepTitle}" ${done ? 'avbockad ✓' : 'åter öppen'} ${by(actorName)}`,
  };
}

export function mutJobsSetGoal({ member, goal, actorName }) {
  return {
    apply(doc) {
      doc.weeklyGoal = goal;
    },
    message: `jobb ${member}: veckomål satt till ${goal} ansökningar ${by(actorName)}`,
  };
}

export function mutJobsMarkReported({ member, month, monthName, actorName }) {
  return {
    apply(doc) {
      if (!Array.isArray(doc.reportedMonths)) doc.reportedMonths = [];
      if (!doc.reportedMonths.includes(month)) doc.reportedMonths.push(month);
    },
    message: `jobb ${member}: aktivitetsrapport för ${monthName} klar ✓ ${by(actorName)}`,
  };
}

export function mutJobsAddApplication({ member, application, actorName, restored = false }) {
  return {
    apply(doc) {
      if (!Array.isArray(doc.applications)) doc.applications = [];
      if (!doc.applications.some((a) => a.id === application.id)) doc.applications.push({ ...application });
    },
    message: `jobb ${member}: ${restored ? `ansökan ${application.company} återställd` : `ny ansökan – ${application.company}${application.role ? ` (${application.role})` : ''}`} ${by(actorName)}`,
  };
}

export function mutJobsUpdateApplication({ member, application, statusChanged, actorName }) {
  const what = statusChanged
    ? `ansökan ${application.company} → ${statusLabel(application.status)}`
    : `ansökan ${application.company} uppdaterad`;
  return {
    apply(doc) {
      const i = (doc.applications || []).findIndex((a) => a.id === application.id);
      if (i >= 0) doc.applications[i] = { ...application };
    },
    message: `jobb ${member}: ${what} ${by(actorName)}`,
  };
}

export function mutJobsDeleteApplication({ member, applicationId, company, actorName }) {
  return {
    apply(doc) {
      doc.applications = (doc.applications || []).filter((a) => a.id !== applicationId);
    },
    message: `jobb ${member}: ansökan ${company} borttagen ${by(actorName)}`,
  };
}
