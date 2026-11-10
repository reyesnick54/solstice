// Demo mode switch. On by default (Nick, Nov 2026): the dashboard opens on an
// illustrative, fully populated experience; one switch shows real sandbox data.
// The preference is a per-browser convenience only, so storage failures fall
// back to the default.

const KEY = 'sunrey.dashboard.demo.v1';
const listeners = new Set();

export function isDemo() {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setDemo(on) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* storage unavailable: the default applies */
  }
  for (const fn of listeners) fn(on);
}

export function onDemoChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The sections whose reads are served by the demo layer. */
export const DEMO_SECTIONS = ['/helios', '/exchange', '/wallets', '/agent', '/vault', '/grow'];

export function onDemoSection() {
  return isDemo() && DEMO_SECTIONS.some((p) => location.pathname.startsWith(p));
}
