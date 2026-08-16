// Bottom sheet för att välja vem som tar ett pass. Rader med tidsval
// (t.ex. Messis enda tur) har dessutom en växel för lunch/kväll.
// Sparar optimistiskt med 600 ms debounce; osparade ändringar sparas direkt
// när sheeten stängs.
import { getState } from '../store.js';
import { mutateWeek, currentActor } from '../controller.js';
import { DAY_LABELS_SHORT, fmtShortDate, isoDateStr } from '../dates.js';
import { mutSetSlot, slotDogs, slotTimeFor } from '../models.js';
import { memberPickerGrid } from '../ui/chips.js';
import { openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

const SLOT_EMOJI = { dog: '🐕', cook: '🍳' };

export function openSlotPicker({ dayKey, slot, dateUTC }) {
  const s = getState();
  const family = s.family;
  const day = s.week?.days?.[dayKey] || {};
  const initial = day.slots?.[slot.id] || [];
  const dogNames = slotDogs(family, slot).map((d) => d.name);

  let selected = [...initial];
  let chosenTime = slot.timeChoice ? slotTimeFor(slot, day) : null;
  let savedTime = chosenTime;
  let saveTimer = null;
  let dirty = false;

  const title = `${SLOT_EMOJI[slot.kind] || ''} ${slot.label} · ${DAY_LABELS_SHORT[dayKey]} ${fmtShortDate(isoDateStr(dateUTC))}`;

  function shortLabelOf(slotId) {
    const sl = (family.slots || []).find((x) => x.id === slotId);
    return sl ? (sl.shortLabel || sl.label) : slotId;
  }

  function doSave(statusEl) {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!dirty) return;
    dirty = false;

    const memberNames = selected.map((id) => family.members.find((m) => m.id === id)?.name || id);
    let slotTimes;
    let suffix = '';
    if (slot.timeChoice && chosenTime !== savedTime) {
      slotTimes = { [slot.id]: chosenTime === slot.timeChoice.default ? null : chosenTime };
      suffix = `; går ${shortLabelOf(chosenTime).toLowerCase()}`;
      savedTime = chosenTime;
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
      slotTimes,
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

  function scheduleSave(statusEl) {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => doSave(statusEl), 600);
  }

  openSheet({
    title,
    build({ body, close }) {
      const sub = document.createElement('p');
      sub.className = 'card-sub';
      sub.textContent = slot.kind === 'dog'
        ? `Vem går med ${dogNames.join(' & ') || 'hundarna'}?`
        : 'Vem lagar maten?';
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
          hint.textContent = '';
          scheduleSave(status);
        },
        onLimit() {
          hint.textContent = 'Max två per promenad';
        },
      });
      body.appendChild(grid);

      // Tidsväxel för rader med dagligt tidsval (t.ex. Messi: lunch/kväll)
      if (slot.timeChoice) {
        const field = document.createElement('div');
        field.className = 'field';
        const label = document.createElement('label');
        label.textContent = `När går ${dogNames.join(' & ') || 'turen'}?`;
        field.appendChild(label);
        const seg = document.createElement('div');
        seg.className = 'segmented';
        seg.setAttribute('role', 'group');
        seg.setAttribute('aria-label', label.textContent);
        for (const option of slot.timeChoice.options) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = shortLabelOf(option);
          btn.setAttribute('aria-pressed', String(chosenTime === option));
          btn.addEventListener('click', () => {
            if (chosenTime === option) return;
            chosenTime = option;
            for (const b of seg.children) b.setAttribute('aria-pressed', 'false');
            btn.setAttribute('aria-pressed', 'true');
            scheduleSave(status);
          });
          seg.appendChild(btn);
        }
        field.appendChild(seg);
        body.appendChild(field);
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
