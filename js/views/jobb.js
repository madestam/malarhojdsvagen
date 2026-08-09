// Jobbcoachen för familjens jobbsökare: AF-checklista, aktivitetsrapport-
// påminnelse, veckomål och ansökningslista. Ton: vuxen, varm, aldrig tjat.
import { getState, setState } from '../store.js';
import { loadJobs, mutateJobs, currentActor, memberById } from '../controller.js';
import {
  currentWeekId, weekIdOfDateStr, addWeeks, fmtShortDate,
  isInReportWindow, dayOfMonthStockholm, currentMonthStr, prevMonthStr, monthNameOf,
  todayStockholm, isoDateStr, capitalize,
} from '../dates.js';
import { mutJobsToggleStep, mutJobsSetGoal, mutJobsMarkReported } from '../models.js';
import { statusPill } from '../ui/chips.js';
import { openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { AF_CHECKLIST, AKTIVITETSRAPPORT_URL, PLATSBANKEN_URL } from '../content/afChecklist.js';
import { openApplicationSheet } from './jobbForm.js';

const requested = new Set();     // personer vars jobbfil begärts
let expandedStep = null;         // öppet checklistesteg
let checklistOpen = null;        // null = auto (stängd när ≥5 klara)
let filter = 'alla';

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
  header.appendChild(el('h1', 'view-title', 'Jobb'));
  container.appendChild(header);

  if (!s.family) {
    const sk = el('div', 'skeleton');
    sk.style.height = '260px';
    sk.style.marginTop = '12px';
    container.appendChild(sk);
    return;
  }

  const seekers = (s.family.settings?.jobSeekers || [])
    .map((id) => memberById(id))
    .filter(Boolean);

  if (seekers.length === 0) {
    container.appendChild(el('p', 'placeholder', 'Inga jobbsökare är inlagda i familjen.'));
    return;
  }

  // Vald person: state → egen identitet om jobbsökare → första
  let person = s.jobPerson && seekers.some((m) => m.id === s.jobPerson) ? s.jobPerson : null;
  if (!person) {
    person = seekers.some((m) => m.id === s.identity) ? s.identity : seekers[0].id;
  }

  if (seekers.length > 1) {
    // Vanliga knappar med aria-pressed (samma mönster som filterchipsen) —
    // inte role=tab, som utlovar tangentbordsbeteende vi inte har.
    const seg = el('div', 'segmented');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', 'Välj jobbsökare');
    seg.style.marginTop = '10px';
    for (const m of seekers) {
      const btn = el('button', '', m.name);
      btn.dataset.fkey = `seg:${m.id}`;
      btn.setAttribute('aria-pressed', String(m.id === person));
      btn.addEventListener('click', () => {
        expandedStep = null;
        checklistOpen = null;
        filter = 'alla';
        loadJobs(m.id);
      });
      seg.appendChild(btn);
    }
    header.appendChild(seg);
  }

  if (!requested.has(person)) {
    requested.add(person);
    loadJobs(person);
  }
  if (s.jobPerson !== person) {
    // säkerställ att aktiv flik och pollning pekar på rätt fil
    setState({ jobPerson: person });
    return;
  }

  const jobs = s.jobs[person];
  if (!jobs) {
    const sk = el('div', 'skeleton');
    sk.style.height = '260px';
    sk.style.marginTop = '12px';
    container.appendChild(sk);
    return;
  }

  const member = memberById(person);

  const banner = renderReportBanner(person, jobs);
  if (banner) container.appendChild(banner);

  container.appendChild(renderGoalCard(person, member, jobs));
  container.appendChild(renderChecklistCard(person, jobs));
  container.appendChild(renderApplicationsCard(person, jobs));
}

// --- Aktivitetsrapport-banner (1–14 varje månad) ---

function renderReportBanner(person, jobs) {
  if (!isInReportWindow()) return null;
  const month = currentMonthStr();
  if ((jobs.reportedMonths || []).includes(month)) return null;

  const day = dayOfMonthStockholm();
  const box = el('section', 'notice');
  box.setAttribute('role', 'region');
  box.setAttribute('aria-label', 'Påminnelse om aktivitetsrapport');
  box.appendChild(el('p', 'notice-title', day >= 12 ? 'Sista dagarna att aktivitetsrapportera!' : 'Dags att aktivitetsrapportera'));
  box.appendChild(el('p', '',
    `Rapportera dina aktiviteter för ${monthNameOf(prevMonthStr())} senast den 14 ${monthNameOf(month)} ` +
    'på Mina sidor. Ansökningslistan här nedanför är ditt facit.'));

  const actions = el('div', 'link-pills');
  const open = el('a', 'link-pill', 'Öppna aktivitetsrapporten');
  open.href = AKTIVITETSRAPPORT_URL;
  open.target = '_blank';
  open.rel = 'noopener';
  actions.appendChild(open);

  const doneBtn = el('button', 'btn-quiet btn-small', 'Klart – jag har rapporterat');
  doneBtn.dataset.fkey = 'report-done';
  doneBtn.addEventListener('click', () => {
    const [y, m] = month.split('-').map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    mutateJobs(person, mutJobsMarkReported({
      member: person, month, monthName: monthNameOf(month), actorName: currentActor().name,
    }))
      .then(() => toast(`Snyggt! Nästa rapport öppnar den 1 ${monthNameOf(nextMonth)}.`))
      .catch(saveError);
  });
  actions.appendChild(doneBtn);
  box.appendChild(actions);
  return box;
}

// --- Veckans mål ---

function countThisWeek(jobs) {
  const week = currentWeekId();
  return (jobs.applications || []).filter(
    (a) => a.status !== 'att-soka' && a.date && weekIdOfDateStr(a.date) === week
  ).length;
}

function streakWeeks(jobs) {
  const weeksWithApps = new Set(
    (jobs.applications || [])
      .filter((a) => a.status !== 'att-soka' && a.date)
      .map((a) => weekIdOfDateStr(a.date))
  );
  let streak = 0;
  let w = currentWeekId();
  while (weeksWithApps.has(w)) {
    streak++;
    w = addWeeks(w, -1);
  }
  return streak;
}

function renderGoalCard(person, member, jobs) {
  const card = el('section', 'card');
  const head = el('div', 'day-head');
  head.appendChild(el('h2', 'card-title', 'Veckans mål'));
  const edit = el('button', 'btn-quiet btn-small', 'Ändra mål');
  edit.dataset.fkey = 'goal-edit';
  edit.addEventListener('click', () => openGoalSheet(person, jobs));
  head.appendChild(edit);
  card.appendChild(head);

  const count = countThisWeek(jobs);
  const goal = jobs.weeklyGoal || 5;
  card.appendChild(el('p', 'goal-big', `${count} av ${goal} ansökningar`));

  const bar = el('div', 'progress');
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', String(goal));
  bar.setAttribute('aria-valuenow', String(count));
  bar.setAttribute('aria-label', `${count} av ${goal} ansökningar`);
  const fill = el('div');
  fill.style.width = Math.min(100, Math.round((count / goal) * 100)) + '%';
  fill.style.setProperty('--member-color', member.color);
  bar.appendChild(fill);
  card.appendChild(bar);

  if (count >= goal) {
    card.appendChild(el('p', 'goal-met', 'Målet nått – snyggt jobbat! 🎯'));
  }

  const streak = streakWeeks(jobs);
  if (streak >= 2) {
    card.appendChild(el('p', 'streak-line', `${streak} veckor i rad med minst en ansökan – håll i!`));
  }

  return card;
}

function openGoalSheet(person, jobs) {
  let goal = jobs.weeklyGoal || 5;
  openSheet({
    title: 'Veckans mål',
    build({ body, close }) {
      const field = el('div', 'field');
      field.appendChild(el('label', '', 'Ansökningar per vecka'));
      const row = el('div', 'input-row');
      row.style.justifyContent = 'center';
      const minus = el('button', 'week-nav-btn', '−');
      minus.setAttribute('aria-label', 'Färre');
      const num = el('span', 'goal-big', String(goal));
      num.style.minWidth = '48px';
      num.style.textAlign = 'center';
      const plus = el('button', 'week-nav-btn', '+');
      plus.setAttribute('aria-label', 'Fler');
      minus.addEventListener('click', () => { goal = Math.max(1, goal - 1); num.textContent = String(goal); });
      plus.addEventListener('click', () => { goal = Math.min(20, goal + 1); num.textContent = String(goal); });
      row.append(minus, num, plus);
      field.appendChild(row);
      body.appendChild(field);

      const save = el('button', 'btn', 'Spara');
      save.style.width = '100%';
      save.style.marginTop = '14px';
      save.addEventListener('click', () => {
        close();
        mutateJobs(person, mutJobsSetGoal({ member: person, goal, actorName: currentActor().name }))
          .catch(saveError);
      });
      body.appendChild(save);
    },
  });
}

// --- AF-checklistan ---

function renderChecklistCard(person, jobs) {
  const card = el('section', 'card');
  const doneCount = AF_CHECKLIST.steps.filter((st) => jobs.checklist[st.id]).length;
  const total = AF_CHECKLIST.steps.length;
  const isOpen = checklistOpen !== null ? checklistOpen : doneCount < 5;

  const toggle = el('button', 'collapse-toggle' + (isOpen ? ' collapse-open' : ''));
  toggle.dataset.fkey = 'af-toggle';
  toggle.setAttribute('aria-expanded', String(isOpen));
  const tWrap = el('span');
  tWrap.appendChild(el('span', 'card-title', AF_CHECKLIST.title));
  tWrap.appendChild(el('span', 'card-sub',
    doneCount === total ? ' Klart! Nu är det bara att söka. 🎉' : ` ${doneCount} av ${total} klara`));
  toggle.appendChild(tWrap);
  const chev = el('span', 'chevron');
  chev.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
  toggle.appendChild(chev);
  toggle.addEventListener('click', () => {
    checklistOpen = !isOpen;
    setState({});
  });
  card.appendChild(toggle);

  if (!isOpen) return card;

  for (const step of AF_CHECKLIST.steps) {
    card.appendChild(renderStep(person, jobs, step));
  }
  card.appendChild(el('p', 'disclaimer', AF_CHECKLIST.disclaimer));
  return card;
}

function renderStep(person, jobs, step) {
  const done = Boolean(jobs.checklist[step.id]);
  const isExpanded = expandedStep === step.id;
  const wrap = el('div', 'check-step' + (done ? ' done' : ''));

  const row = el('div', 'check-step-row');

  const check = el('button', 'chore-check');
  check.dataset.fkey = `step:${step.id}`;
  check.setAttribute('role', 'checkbox');
  check.setAttribute('aria-checked', String(done));
  check.setAttribute('aria-label', `Markera "${step.title}" som ${done ? 'ej klar' : 'klar'}`);
  const box = el('span', 'box');
  box.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
  check.appendChild(box);
  check.addEventListener('click', () => {
    mutateJobs(person, mutJobsToggleStep({
      member: person,
      stepId: step.id,
      stepTitle: step.title,
      done: !done,
      doneDate: isoDateStr(todayStockholm()),
      actorName: currentActor().name,
    })).catch(saveError);
  });
  row.appendChild(check);

  const main = el('button', 'check-step-main');
  main.dataset.fkey = `step-main:${step.id}`;
  main.setAttribute('aria-expanded', String(isExpanded));
  const title = el('span', 'check-step-title', step.title);
  if (step.important) title.appendChild(el('span', 'important-badge', 'Viktig'));
  main.appendChild(title);
  main.appendChild(el('span', 'check-step-short', step.short));
  main.addEventListener('click', () => {
    expandedStep = isExpanded ? null : step.id;
    setState({});
  });
  row.appendChild(main);
  wrap.appendChild(row);

  if (isExpanded) {
    const body = el('div', 'check-step-body');
    body.appendChild(el('p', '', step.body));
    const pills = el('div', 'link-pills');
    for (const link of step.links) {
      const a = el('a', 'link-pill', link.label + ' ↗');
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener';
      pills.appendChild(a);
    }
    body.appendChild(pills);
    wrap.appendChild(body);
  }

  return wrap;
}

// --- Ansökningar ---

const FILTERS = [
  { id: 'alla', label: 'Alla', match: () => true },
  { id: 'att-soka', label: 'Att söka', match: (a) => a.status === 'att-soka' },
  { id: 'aktiva', label: 'Aktiva', match: (a) => a.status === 'sokt' || a.status === 'intervju' },
  { id: 'avslutade', label: 'Avslutade', match: (a) => a.status === 'nej-tack' || a.status === 'erbjudande' },
];

function renderApplicationsCard(person, jobs) {
  const card = el('section', 'card');
  const head = el('div', 'day-head');
  const t = el('span');
  t.appendChild(el('h2', 'card-title', 'Ansökningar'));
  t.appendChild(el('span', 'card-sub', ` ${(jobs.applications || []).length} st`));
  head.appendChild(t);
  const add = el('button', 'btn btn-small', '+ Ny ansökan');
  add.dataset.fkey = 'app-add';
  add.addEventListener('click', () => openApplicationSheet({ person, application: null }));
  head.appendChild(add);
  card.appendChild(head);

  const apps = jobs.applications || [];

  if (apps.length === 0) {
    const empty = el('div', 'empty-state');
    empty.appendChild(el('p', 'empty-title', 'Inga ansökningar än'));
    empty.appendChild(el('p', 'empty-body',
      'Första är svårast. Hitta ett jobb på Platsbanken och lägg in det – så är bollen i rullning.'));
    const actions = el('div', 'empty-actions');
    const pb = el('a', 'btn btn-secondary', 'Öppna Platsbanken');
    pb.href = PLATSBANKEN_URL;
    pb.target = '_blank';
    pb.rel = 'noopener';
    actions.appendChild(pb);
    empty.appendChild(actions);
    card.appendChild(empty);
    return card;
  }

  const filterRow = el('div', 'filter-row');
  for (const f of FILTERS) {
    const chip = el('button', 'filter-chip', f.label);
    chip.dataset.fkey = `filter:${f.id}`;
    chip.setAttribute('aria-pressed', String(filter === f.id));
    chip.addEventListener('click', () => {
      filter = f.id;
      setState({});
    });
    filterRow.appendChild(chip);
  }
  card.appendChild(filterRow);

  const active = FILTERS.find((f) => f.id === filter) || FILTERS[0];
  const shown = apps.filter(active.match).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (shown.length === 0) {
    card.appendChild(el('p', 'placeholder', 'Inget i den här listan just nu.'));
    return card;
  }

  for (const a of shown) {
    const row = el('button', 'app-row');
    row.dataset.fkey = `app:${a.id}`;
    row.setAttribute('aria-label', `Redigera ansökan ${a.company}`);
    const main = el('span', 'app-main');
    main.appendChild(el('span', 'app-company', a.company));
    const sub = [a.role, fmtShortDate(a.date)].filter(Boolean).join(' · ');
    if (sub) main.appendChild(el('span', 'app-sub', sub));
    row.appendChild(main);
    if (a.url) {
      const link = el('a', 'link-pill', '↗');
      link.href = a.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('aria-label', `Öppna annonsen för ${a.company}`);
      link.addEventListener('click', (e) => e.stopPropagation());
      row.appendChild(link);
    }
    row.appendChild(statusPill(a.status));
    row.addEventListener('click', () => openApplicationSheet({ person, application: a }));
    card.appendChild(row);
  }

  return card;
}
