// Fiktiv demodata för dev-läget (?dev=1). Inga riktiga namn här —
// riktiga familjedata ligger enbart i det privata datarepot.
export const DEV_FAMILY = {
  version: 1,
  settings: {
    title: 'Demofamiljen',
    timezone: 'Europe/Stockholm',
    jobSeekers: ['cilla', 'david'],
  },
  members: [
    { id: 'anna',  name: 'Anna',  color: '#0072B2', initial: 'A' },
    { id: 'bosse', name: 'Bosse', color: '#CC79A7', initial: 'B' },
    { id: 'cilla', name: 'Cilla', color: '#E69F00', initial: 'C' },
    { id: 'david', name: 'David', color: '#009E73', initial: 'D' },
    { id: 'elsa',  name: 'Elsa',  color: '#D55E00', initial: 'E' },
  ],
  dogs: [
    { id: 'rex',  name: 'Rex' },
    { id: 'fido', name: 'Fido' },
  ],
  slots: [
    { id: 'hund-morgon', label: 'Morgonpromenad', shortLabel: 'Morgon', kind: 'dog',  order: 1 },
    { id: 'hund-lunch',  label: 'Lunchpromenad',  shortLabel: 'Lunch',  kind: 'dog',  order: 2 },
    { id: 'hund-kvall',  label: 'Kvällspromenad', shortLabel: 'Kväll',  kind: 'dog',  order: 3 },
    { id: 'matlagning',  label: 'Middag',         shortLabel: 'Middag', kind: 'cook', order: 4 },
  ],
  choreTemplates: [
    { id: 'handla-mat',  label: 'Handla mat' },
    { id: 'tvatt',       label: 'Tvätt' },
    { id: 'dammsuga',    label: 'Dammsuga' },
    { id: 'sopor',       label: 'Ta ut soporna' },
    { id: 'panta',       label: 'Panta & återvinning' },
  ],
};

export function devSeedWeek(weekId) {
  return {
    version: 1,
    week: weekId,
    note: 'Demovecka — allt här är påhittat',
    days: {
      mon: { note: '', slots: { 'hund-morgon': ['anna'], 'hund-lunch': ['bosse'], 'hund-kvall': ['cilla', 'david'], matlagning: ['elsa'] } },
      tue: { note: '', slots: { 'hund-morgon': ['david'], matlagning: ['anna'] } },
      wed: { note: '', slots: {} },
      thu: { note: '', slots: { 'hund-kvall': ['elsa'] } },
      fri: { note: '', slots: {} },
      sat: { note: '', slots: {} },
      sun: { note: '', slots: {} },
    },
    chores: [
      { id: 'dv01', label: 'Handla mat', assignees: ['bosse'], day: 'sat', done: false },
      { id: 'dv02', label: 'Tvätt', assignees: ['cilla'], day: null, done: true },
    ],
    updatedAt: '2026-08-01T10:00:00Z',
    updatedBy: 'anna',
  };
}

export function devSeedJobs(memberId, todayStr) {
  return {
    version: 1,
    member: memberId,
    weeklyGoal: 5,
    reportedMonths: [],
    checklist: memberId === 'cilla' ? { 'skriv-in': '2026-08-01', 'a-kassa': '2026-08-02' } : {},
    applications: memberId === 'cilla'
      ? [
          { id: 'dj01', company: 'Kafé Kanel', role: 'Barista', date: todayStr, status: 'sokt', url: '', notes: 'Trevligt första samtal' },
          { id: 'dj02', company: 'Lagret AB', role: 'Lagermedarbetare', date: '2026-08-03', status: 'intervju', url: '', notes: '' },
        ]
      : [],
  };
}
