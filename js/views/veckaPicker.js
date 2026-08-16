// Bottom sheet för att välja vem som tar ett pass — och vilka hundar som
// följer med (hundar med dagligt val, t.ex. Messi: lunch eller kväll).
// Sparar optimistiskt med 600 ms debounce; osparade ändringar sparas direkt
// när sheeten stängs.
import { getState } from '../store.js';
import { mutateWeek, currentActor } from '../controller.js';
import { DAY_LABELS_SHORT, fmtShortDate, isoDateStr } from '../dates.js';
import { mutSetSlot, dogChoiceFor } from '../models.js';
import { memberPickerGrid } from '../ui/chips.js';
import { openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

const SLOT_EMOJI = { dog: '🐕', cook: '🍳' };

export function openSlotPicker({ dayKey, slot, dateUTC }) {
  const s = getState();
  const family = s.family;
  const day = s.week?.days?.[dayKey] || {};
  const initial = day.slots?.[slot.id] || [];

  // Hundar som kan välja denna promenad (t.ex. Messi: lunch eller kväll)
  const choiceDogs = slot.kind === 'dog'
    ? (family.dogs || []).filter((d) => d.choice && d.choice.slots.includes(slot.id))
    : [];
  const fixedDogNames = slot.kind === 'dog'
    ? (family.dogs || []).filter((d) => (slot.dogs || []).includes(d.id)).map((d) => d.name)
    : [];

  let selected = [...initial];
  const initialDogState = Object.fromEntries(choiceDogs.map((d) => [d.id, dogChoiceFor(day, d)]));
  const dogState = { ...initialDogState };
  let saveTimer = null;
  let dirty = false;

  const title = `${SLOT_EMOJI[slot.kind] || ''} ${slot.label} · ${DAY_LABELS_SHORT[dayKey]} ${fmtShortDate(isoDateStr(dateUTC))}`;

  function shortLabelOf(slotId) {
    const sl = (family.slots || []).find((x) => x.id === slotId);
    return sl ? (sl.shortLabel || sl.label) : slotId;
  }

  function dogsOnThisWalk() {
    return [
      ...fixedDogNames,
      ...choiceDogs.filter((d) => dogState[d.id] === slot.id).map((d) => d.name),
    ];
  }

  function doSave(statusEl) {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!dirty) return;
    dirty = false;

    const memberNames = selected.map((id) => family.members.find((m) => m.id === id)?.name || id);
    const dogUpdates = {};
    let suffix = '';
    for (const d of choiceDogs) {
      if (dogState[d.id] !== initialDogState[d.id]) {
        dogUpdates[d.id] = dogState[d.id] === d.choice.default ? null : dogState[d.id];
        suffix += `; ${d.name} → ${shortLabelOf(dogState[d.id])}`;
        initialDogState[d.id] = dogState[d.id]; // så nästa autospar inte upprepar
      }
    }

    if (statusEl) statusEl.textContent = 'Sparar…';
    mutateWeek(mutSetSlot({
      weekId: getState().weekId,
      dayKey,
      dayLabelShort: DAY_LABELS_SHORT[dayKey],
      slotId: slot.id,
      slotLabel: slot.label,
      memberIds: selected,
      memberNames,
      actorName: currentActor().name,
      dogUpdates: Object.keys(dogUpdates).length ? dogUpdates : undefined,
      suffix,
    }))
      .then(() => {
        if (statusEl && statusEl.isConnected) statusEl.textContent = 'Sparat ✓';
      })
      .catch(() => {
        if (statusEl && statusEl.isConnected) statusEl.textContent = '';
        toast('Kunde inte spara – kontrollera nätet och försök igen');
      });
  }

  openSheet({
    title,
    build({ body, close }) {
      const sub = document.createElement('p');
      sub.className = 'card-sub';
      const updateSub = () => {
        sub.textContent = slot.kind === 'dog'
          ? `Vem går med ${dogsOnThisWalk().join(' & ') || 'hundarna'}?`
          : 'Vem lagar maten?';
      };
      updateSub();
      body.appendChild(sub);

      const status = document.createElement('div');
      status.className = 'picker-status';
      status.setAttribute('aria-live', 'polite');

      const hint = document.createElement('div');
      hint.className = 'picker-hint';

      const grid = memberPickerGrid({
        members: family.members,
        selected,
        max: slot.kind === 'dog' ? 2 : null,
        multi: true,
        onChange(ids) {
          selected = ids;
          dirty = true;
          hint.textContent = '';
          clearTimeout(saveTimer);
          saveTimer = setTimeout(() => doSave(status), 600);
        },
        onLimit() {
          hint.textContent = 'Max två per promenad';
        },
      });
      body.appendChild(grid);

      // Växel per hund med dagligt val: "Messi följer med på denna promenad"
      for (const d of choiceDogs) {
        const otherSlot = d.choice.slots.find((x) => x !== slot.id) || d.choice.default;
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'dog-toggle';
        const update = () => {
          const here = dogState[d.id] === slot.id;
          row.setAttribute('aria-pressed', String(here));
          row.innerHTML = `<span aria-hidden="true">🐶</span><span>${d.name} följer med på denna promenad</span>`
            + `<span class="dog-toggle-state">${here ? 'Ja' : `Nej – går ${shortLabelOf(dogState[d.id]).toLowerCase()}`}</span>`;
        };
        update();
        row.addEventListener('click', () => {
          dogState[d.id] = dogState[d.id] === slot.id ? otherSlot : slot.id;
          dirty = true;
          update();
          updateSub();
          clearTimeout(saveTimer);
          saveTimer = setTimeout(() => doSave(status), 600);
        });
        body.appendChild(row);
      }

      body.appendChild(hint);
      body.appendChild(status);

      const done = document.createElement('button');
      done.className = 'btn';
      done.style.width = '100%';
      done.style.marginTop = '10px';
      done.textContent = 'Klar';
      done.addEventListener('click', close);
      body.appendChild(done);
    },
    onClose() {
      doSave(null); // spola osparade ändringar direkt
    },
  });
}
