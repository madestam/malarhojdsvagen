// Bottom sheet med fokusfälla, Esc och backdrop-stängning.
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

let openCount = 0;

export function openSheet({ title, build, onClose }) {
  const rootEl = document.getElementById('sheet-root');
  const invoker = document.activeElement;

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'sheet-header';
  const h = document.createElement('h2');
  h.className = 'sheet-title';
  h.textContent = title;
  h.tabIndex = -1;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'sheet-close';
  closeBtn.setAttribute('aria-label', 'Stäng');
  closeBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
  header.append(h, closeBtn);

  const body = document.createElement('div');
  body.className = 'sheet-body';

  sheet.append(header, body);
  backdrop.appendChild(sheet);
  rootEl.appendChild(backdrop);
  openCount++;
  document.body.classList.add('sheet-open');

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    openCount--;
    if (openCount <= 0) document.body.classList.remove('sheet-open');
    backdrop.classList.add('sheet-closing');
    setTimeout(() => backdrop.remove(), 200);
    document.removeEventListener('keydown', onKey, true);
    if (onClose) onClose();
    if (invoker && invoker.isConnected && typeof invoker.focus === 'function') invoker.focus();
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'Tab') {
      const focusables = [...sheet.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled && el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey, true);

  const api = { close, body, sheet };
  build(api);
  requestAnimationFrame(() => h.focus());
  return api;
}
