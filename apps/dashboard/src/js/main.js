import { api, getSession, onSessionChange } from './api.js';
import { authScreen, isStrong, signOut } from './auth.js';
import { CONFIG } from './config.js';
import { setAssetDecimals } from './format.js';
import { badge, clear, envBadge, h } from './ui.js';

import { homeView } from './views/home.js';
import { moneyView } from './views/money.js';
import { growView } from './views/grow.js';
import { heliosView } from './views/helios.js';
import { exchangeView } from './views/exchange.js';
import { walletsView } from './views/wallets.js';
import { agentView } from './views/agent.js';
import { accessView } from './views/access.js';
import { vaultView } from './views/vault.js';
import { settingsView } from './views/settings.js';

const ROUTES = [
  { path: '/', label: 'Home', view: homeView, icon: '◐' },
  { path: '/money', label: 'Money & Banking', view: moneyView, icon: '◇' },
  { path: '/grow', label: 'Grow My Money', view: growView, icon: '△' },
  { path: '/helios', label: 'Helios Desk', view: heliosView, icon: '☉' },
  { path: '/exchange', label: 'Exchange', view: exchangeView, icon: '⇄' },
  { path: '/wallets', label: 'Wallets & Chain', view: walletsView, icon: '⬡' },
  { path: '/agent', label: 'Financial Agent', view: agentView, icon: '✦' },
  { path: '/access', label: 'Access', view: accessView, icon: '◈' },
  { path: '/vault', label: 'Vault & HIN', view: vaultView, icon: '▣' },
  { path: '/settings', label: 'Settings & Security', view: settingsView, icon: '⚙' },
];

const app = document.getElementById('app');

function currentRoute() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  return ROUTES.find((r) => r.path === path) || ROUTES[0];
}

export function navigate(path) {
  if (location.pathname !== path) history.pushState({}, '', path);
  render();
}

function link(route, active) {
  return h(
    'a',
    {
      href: route.path,
      class: `nav-link ${active ? 'active' : ''}`,
      'aria-current': active ? 'page' : null,
      onclick: (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        navigate(route.path);
      },
    },
    h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, route.icon),
    h('span', null, route.label),
  );
}

function shell(route) {
  const session = getSession();
  const main = h('main', { class: 'main', id: 'main', tabindex: '-1' });
  const strength = isStrong() ? badge('Verified session', 'positive') : badge('Standard session', 'muted');
  const layout = h(
    'div',
    { class: 'layout' },
    h(
      'aside',
      { class: 'sidebar' },
      h('a', { href: '/', class: 'brand', onclick: (e) => { e.preventDefault(); navigate('/'); } }, h('img', { src: '/assets/wordmark.svg', alt: 'SunRey', width: '132', height: '20' })),
      h('nav', { class: 'nav', 'aria-label': 'Dashboard' }, ROUTES.map((r) => link(r, r === route))),
      h(
        'div',
        { class: 'sidebar-foot' },
        h('p', { class: 'muted small' }, 'Simulated environment. Not a bank account, not investment advice, no real money.'),
      ),
    ),
    h(
      'div',
      { class: 'content' },
      h(
        'header',
        { class: 'topbar' },
        h('div', { class: 'topbar-left' }, h('h1', { class: 'page-title' }, route.label), envBadge(CONFIG.environmentLabel)),
        h(
          'div',
          { class: 'topbar-right' },
          strength,
          h('span', { class: 'muted small user' }, session && session.email ? session.email : ''),
          h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => { await signOut(); render(); } }, 'Sign out'),
        ),
      ),
      main,
    ),
  );
  return { layout, main };
}

let decimalsLoaded = false;
async function loadDecimals() {
  if (decimalsLoaded) return;
  try {
    const data = await api.get('/economy/assets');
    const map = {};
    for (const item of data.items || []) {
      const a = item.asset || item;
      if (a.assetId && Number.isInteger(a.decimals)) map[a.assetId] = a.decimals;
    }
    setAssetDecimals(map);
    decimalsLoaded = true;
  } catch {
    /* defaults stay */
  }
}

function render() {
  clear(app);
  if (!getSession()) {
    app.append(authScreen(() => navigate('/')));
    document.title = 'Sign in · SunRey';
    return;
  }
  const route = currentRoute();
  const { layout, main } = shell(route);
  app.append(layout);
  document.title = `${route.label} · SunRey`;
  loadDecimals().finally(() => main.append(route.view({ navigate, refreshShell: render })));
}

window.addEventListener('popstate', render);
onSessionChange((s) => {
  if (!s) render();
});
render();
