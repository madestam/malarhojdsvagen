// Bottom sheet för att välja vem som tar ett pass. Sparar optimistiskt med
// 600 ms debounce; osparade ändringar sparas direkt när sheeten stängs.
import { getState } from '../store.js';
import { mutateWeek, currentActor } from '../controller.js';
import { DAY_LABELS_SHORT, fmtShortDate, isoDateStr } from '../dates.js';
import { mutSetSlot } from '../models.js';
import { memberPickerGrid } from '../ui/chips.js';
import { openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

const SLOT_EMOJI = { dog: '🐕', cook: '🍳' };

export function openSlotPicker({ dayKey, slot, dateUTC }) {
  const s = getState();
  const family = s.family;
  const initial = s.week?.days?.[dayKey]?.slots?.[slot.id] || [];

  let selected = [...initial];
  let saveTimer = null;
  let dirty = false;

  const title = `${SLOT_EMOJI[slot.kind] || ''} ${slot.label} · ${DAY_LABELS_SHORT[dayKey]} ${fmtShortDate(isoDateStr(dateUTC))}`;

  function doSave(statusEl) {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!dirty) return;
    dirty = false;
    const memberNames = selected.map((id) => family.members.find((m) => m.id === id)?.name || id);
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
      const subtitle = slot.kind === 'dog'
        ? `Vem går med ${(family.dogs || []).map((d) => d.name).join(' & ')}?`
        : 'Vem lagar maten?';
      const sub = document.createElement('p');
      sub.className = 'card-sub';
      sub.textContent = subtitle;
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
