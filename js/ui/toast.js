// Toasts med valfri åtgärdsknapp (t.ex. "Ångra").
const root = () => document.getElementById('toast-root');

let current = null;

export function toast(message, { action, duration = 3000 } = {}) {
  if (current) current.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);
  if (action) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      el.remove();
      if (current === el) current = null;
      action.onClick();
    });
    el.appendChild(btn);
    duration = Math.max(duration, 5000);
  }
  root().appendChild(el);
  current = el;
  setTimeout(() => {
    if (el.isConnected) {
      el.classList.add('toast-out');
      setTimeout(() => el.remove(), 250);
    }
    if (current === el) current = null;
  }, duration);
}
