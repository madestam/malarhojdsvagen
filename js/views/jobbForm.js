// Formulär för ny/redigerad ansökan + peppning vid sparning.
import { getState } from '../store.js';
import { mutateJobs, currentActor } from '../controller.js';
import { todayStockholm, isoDateStr } from '../dates.js';
import {
  APPLICATION_STATUSES, randomId,
  mutJobsAddApplication, mutJobsUpdateApplication, mutJobsDeleteApplication,
} from '../models.js';
import { openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { UPPMUNTRAN_SOKT } from '../content/afChecklist.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function saveError() {
  toast('Kunde inte spara – kontrollera nätet och försök igen');
}

function encourage(status, appCount, statusChanged) {
  if (status === 'sokt' && statusChanged) {
    toast(UPPMUNTRAN_SOKT[appCount % UPPMUNTRAN_SOKT.length]);
  } else if (status === 'intervju' && statusChanged) {
    toast('Intervju! Lycka till – du fixar det. 💪');
  } else if (status === 'erbjudande' && statusChanged) {
    toast('ERBJUDANDE! Grattis – det här firar vi! 🎉', { duration: 5000 });
    confetti();
  } else if (status === 'nej-tack' && statusChanged) {
    toast('Ett nej på vägen mot ett ja. Vidare.');
  } else {
    toast('Sparat');
  }
}

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#0072B2', '#CC79A7', '#E69F00', '#009E73', '#D55E00', '#C05621'];
  for (let i = 0; i < 36; i++) {
    const bit = document.createElement('div');
    bit.className = 'confetti';
    bit.style.left = Math.random() * 100 + 'vw';
    bit.style.background = colors[i % colors.length];
    bit.style.animationDelay = Math.random() * 0.4 + 's';
    bit.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(bit);
    setTimeout(() => bit.remove(), 1600);
  }
}

export function openApplicationSheet({ person, application }) {
  const isNew = !application;
  const draft = application
    ? { ...application }
    : { id: randomId(5), company: '', role: '', date: isoDateStr(todayStockholm()), status: 'sokt', url: '', notes: '' };
  const originalStatus = application?.status || null;

  openSheet({
    title: isNew ? 'Ny ansökan' : 'Redigera ansökan',
    build({ body, close }) {
      const mkInput = (labelText, key, type = 'text', placeholder = '') => {
        const field = el('div', 'field');
        const id = 'app-field-' + key;
        const label = el('label', '', labelText);
        label.setAttribute('for', id);
        const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
        input.className = type === 'textarea' ? 'textarea' : 'input';
        input.id = id;
        if (type !== 'textarea') input.type = type;
        input.value = draft[key] || '';
        if (placeholder) input.placeholder = placeholder;
        input.addEventListener('input', () => { draft[key] = input.value; });
        field.append(label, input);
        body.appendChild(field);
        return input;
      };

      const companyInput = mkInput('Företag', 'company', 'text', 'T.ex. ICA Maxi');
      mkInput('Roll', 'role', 'text', 'T.ex. Butiksmedarbetare');
      mkInput('Datum', 'date', 'date');

      const statusField = el('div', 'field');
      statusField.appendChild(el('label', '', 'Status'));
      const statusRow = el('div', 'filter-row');
      for (const st of APPLICATION_STATUSES) {
        const chip = el('button', 'filter-chip', st.label);
        chip.type = 'button';
        chip.setAttribute('aria-pressed', String(draft.status === st.id));
        chip.addEventListener('click', () => {
          draft.status = st.id;
          for (const c of statusRow.children) c.setAttribute('aria-pressed', 'false');
          chip.setAttribute('aria-pressed', 'true');
        });
        statusRow.appendChild(chip);
      }
      statusField.appendChild(statusRow);
      body.appendChild(statusField);

      mkInput('Länk till annonsen', 'url', 'url', 'https://…');
      mkInput('Anteckningar', 'notes', 'textarea', 'Kontaktperson, lön, känsla…');

      const err = el('p', 'key-err', '');
      body.appendChild(err);

      const save = el('button', 'btn', 'Spara');
      save.style.width = '100%';
      save.style.marginTop = '14px';
      save.addEventListener('click', () => {
        if (!draft.company.trim()) {
          err.textContent = 'Fyll i företag.';
          companyInput.focus();
          return;
        }
        draft.company = draft.company.trim();
        const statusChanged = isNew || draft.status !== originalStatus;
        const appCount = (getState().jobs[person]?.applications || []).length;
        close();
        const mutation = isNew
          ? mutJobsAddApplication({ member: person, application: draft, actorName: currentActor().name })
          : mutJobsUpdateApplication({ member: person, application: draft, statusChanged, actorName: currentActor().name });
        mutateJobs(person, mutation)
          .then(() => encourage(draft.status, appCount, statusChanged))
          .catch(saveError);
      });
      body.appendChild(save);

      if (!isNew) {
        const del = el('button', 'btn-quiet btn-danger-quiet', 'Ta bort');
        del.style.width = '100%';
        del.style.marginTop = '6px';
        del.addEventListener('click', () => {
          close();
          const snapshot = { ...application };
          mutateJobs(person, mutJobsDeleteApplication({
            member: person, applicationId: application.id, company: application.company, actorName: currentActor().name,
          }))
            .then(() => {
              toast('Ansökan togs bort', {
                action: {
                  label: 'Ångra',
                  onClick: () => {
                    mutateJobs(person, mutJobsAddApplication({
                      member: person, application: snapshot, actorName: currentActor().name, restored: true,
                    })).catch(saveError);
                  },
                },
              });
            })
            .catch(saveError);
        });
        body.appendChild(del);
      }
    },
  });
}
