// Medlemsavatarer, chips och väljargrid. Färg är aldrig enda signalen —
// initial och namn följer alltid med.
import { statusLabel } from '../models.js';

export function memberAvatar(member, size = 32) {
  const el = document.createElement('span');
  el.className = 'avatar';
  el.style.setProperty('--member-color', member.color);
  el.style.width = size + 'px';
  el.style.height = size + 'px';
  el.style.fontSize = Math.round(size * 0.44) + 'px';
  el.textContent = member.initial || member.name.charAt(0);
  el.setAttribute('aria-hidden', 'true');
  return el;
}

// Litet chip med avatar + namn.
export function memberChip(member, { size = 24 } = {}) {
  const el = document.createElement('span');
  el.className = 'member-chip';
  el.style.setProperty('--member-color', member.color);
  el.appendChild(memberAvatar(member, size));
  const name = document.createElement('span');
  name.textContent = member.name;
  el.appendChild(name);
  return el;
}

// Väljargrid för sheets: stora chips, multi- eller singelval.
// onChange får hela listan av valda id:n.
export function memberPickerGrid({ members, selected = [], max = null, multi = true, onChange, onLimit }) {
  const chosen = new Set(selected);
  const grid = document.createElement('div');
  grid.className = 'picker-grid';

  for (const m of members) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'picker-chip';
    btn.style.setProperty('--member-color', m.color);
    btn.setAttribute('aria-pressed', String(chosen.has(m.id)));
    btn.appendChild(memberAvatar(m, 52));
    const name = document.createElement('span');
    name.className = 'picker-name';
    name.textContent = m.name;
    btn.appendChild(name);
    const check = document.createElement('span');
    check.className = 'picker-check';
    check.setAttribute('aria-hidden', 'true');
    check.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
    btn.appendChild(check);

    btn.addEventListener('click', () => {
      if (chosen.has(m.id)) {
        chosen.delete(m.id);
      } else {
        if (!multi) chosen.clear();
        if (max && chosen.size >= max) {
          if (onLimit) onLimit();
          btn.classList.remove('picker-shake');
          void btn.offsetWidth; // starta om animationen
          btn.classList.add('picker-shake');
          return;
        }
        chosen.add(m.id);
      }
      for (const b of grid.querySelectorAll('.picker-chip')) {
        const id = b.dataset.memberId;
        b.setAttribute('aria-pressed', String(chosen.has(id)));
      }
      onChange([...chosen]);
    });
    btn.dataset.memberId = m.id;
    grid.appendChild(btn);
  }
  return grid;
}

export function statusPill(status) {
  const el = document.createElement('span');
  el.className = 'status-pill status-' + status;
  el.textContent = statusLabel(status);
  return el;
}
