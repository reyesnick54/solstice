import { api, getSession, onSessionChange } from './api.js';
import { authScreen, isStrong, requireStrong, signOut } from './auth.js';
import { CONFIG } from './config.js';
import { DEMO_SECTIONS, isDemo, setDemo } from './demo/state.js';
import { setAssetDecimals } from './format.js';
import { badge, clear, envBadge, h, svg } from './ui.js';

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

// Hand-drawn 20px line icons, 1.25px stroke, round caps (sunrey.xyz §5.7).
const ICONS = {
  home: ['M3 14.5h14', 'M6 14.5a4 4 0 0 1 8 0', 'M10 5v2', 'M4.6 8.4l1.4 1.4', 'M15.4 8.4L14 9.8'],
  money: ['M3 8l7-4 7 4', 'M4.5 8.5v6', 'M8.2 8.5v6', 'M11.8 8.5v6', 'M15.5 8.5v6', 'M3 16.5h14'],
  grow: ['M3 15.5l4.5-4.5 3 3L17 7.5', 'M12.5 7.5H17V12'],
  helios: ['C10 10 3', 'M10 2.5v2', 'M10 15.5v2', 'M2.5 10h2', 'M15.5 10h2', 'M4.7 4.7l1.4 1.4', 'M13.9 13.9l1.4 1.4', 'M4.7 15.3l1.4-1.4', 'M13.9 6.1l1.4-1.4'],
  exchange: ['M4 7h12', 'M13 4l3 3-3 3', 'M16 13H4', 'M7 10l-3 3 3 3'],
  wallets: ['M3.5 6.5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-11z', 'M3.5 6.5V5.5a2 2 0 0 1 2-2h7', 'M13.5 11.5h3'],
  agent: ['C10 10 2.5', 'M10 3.5a6.5 6.5 0 0 1 6.5 6.5', 'M10 16.5A6.5 6.5 0 0 1 3.5 10', 'C16.5 10 0.6'],
  access: ['C7 10 3.5', 'M10.5 10H17', 'M14.5 10v2.5', 'M17 10v2'],
  vault: ['M10 2.8l6 2.4v4.3c0 3.6-2.5 6.3-6 7.7-3.5-1.4-6-4.1-6-7.7V5.2z', 'M7.5 10l1.8 1.8 3.2-3.3'],
  settings: ['M3.5 6h13', 'M3.5 14h13', 'C7 6 1.8', 'C13 14 1.8'],
};

function icon(name) {
  const parts = (ICONS[name] || []).map((d) => {
    if (d.startsWith('C')) {
      const [cx, cy, r] = d.slice(1).trim().split(/\s+/);
      return svg('circle', { cx, cy, r });
    }
    return svg('path', { d });
  });
  return svg('svg', { class: 'nav-icon', viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.25', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, ...parts);
}

const ROUTES = [
  { path: '/', label: 'Home', view: homeView, icon: 'home', title: ['Your economy,', 'in one view.'], lede: 'Cash, digital assets and investments, each shown on its own terms and never blended into one number.' },
  { group: 'Money', path: '/money', label: 'Money & Banking', view: moneyView, icon: 'money', title: ['Money & Banking'], lede: 'Open sandbox cash accounts, add simulated funds and move money between your accounts. Every balance is read back from the ledger.' },
  { path: '/grow', label: 'Grow My Money', view: growView, icon: 'grow', title: ['Grow My Money'], lede: 'Your plan, your limits and the paper strategies working inside them. Deposits are never counted as performance, and no return is promised.' },
  { group: 'Markets', path: '/helios', label: 'Helios Desk', view: heliosView, icon: 'helios', title: ['Helios Desk'], lede: 'The AI trading desk. Specialist agents propose; the Compliance Kernel, Risk Engine and Execution Authority decide.' },
  { path: '/exchange', label: 'Exchange', view: exchangeView, icon: 'exchange', title: ['Exchange'], lede: 'Trade SunRey Coin and MoonRey Coin on testnet markets backed by internal sandbox liquidity.' },
  { path: '/wallets', label: 'Wallets & Chain', view: walletsView, icon: 'wallets', title: ['Wallets & Chain'], lede: 'Native SunRey Chain wallets for SR and MR, and the registry entries that define each asset.' },
  { group: 'You', path: '/agent', label: 'Financial Agent', view: agentView, icon: 'agent', title: ['Financial Agent'], lede: 'Proposals from your agent, with the reasons behind them. Nothing runs until you approve it and the Kernel allows it.' },
  { path: '/access', label: 'Access', view: accessView, icon: 'access', title: ['Access'], lede: 'Entitlements and reservations from SunRey Access, kept apart from token balances and cash.' },
  { path: '/vault', label: 'Vault & HIN', view: vaultView, icon: 'vault', title: ['Vault & HIN'], lede: 'Who may use your information, for what purpose, and what your verified contributions have earned. Raw records never leave the Vault.' },
  { path: '/settings', label: 'Settings & Security', view: settingsView, icon: 'settings', title: ['Settings & Security'], lede: 'Your profile, two-step verification and what is switched on for your account.' },
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
    icon(route.icon),
    h('span', null, route.label),
  );
}

function navItems(active) {
  const out = [];
  for (const r of ROUTES) {
    if (r.group) out.push(h('p', { class: 'nav-group', 'aria-hidden': 'true' }, r.group));
    out.push(link(r, r === active));
  }
  return out;
}

function pageHead(route) {
  const [first, second] = route.title;
  return h(
    'header',
    { class: 'page-head' },
    h('h1', { class: 'page-title' }, first, second ? h('span', { class: 'accent' }, second) : null),
    route.lede ? h('p', { class: 'page-lede' }, route.lede) : null,
  );
}

function demoBanner(route) {
  if (!isDemo()) return null;
  const here = DEMO_SECTIONS.includes(route.path) || route.path === '/';
  return h(
    'aside',
    { class: 'demo-banner', role: 'note' },
    h('span', { class: 'badge badge-env' }, 'Demo data'),
    h('p', null, route.path === '/' ? 'Digital assets, investments and agent proposals here are illustrative. Your cash balance and money activity are real sandbox data.' : here ? 'This page shows illustrative data. Nothing here is real money, a real trade or a real person, and no figure reflects performance.' : 'Helios, Grow, Exchange, Wallets, Financial Agent and Vault show illustrative data. This page shows your real sandbox data.'),
    h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { setDemo(false); render(); } }, 'Show my real data'),
  );
}

function shell(route) {
  const session = getSession();
  const main = h('main', { class: 'main', id: 'main', tabindex: '-1' });
  const strength = isStrong()
    ? badge('Verified', 'positive')
    : h('button', { class: 'btn btn-sm', title: 'Two-step verification unlocks digital assets, markets and money actions', onclick: async () => { if (await requireStrong('Unlocking your dashboard')) render(); } }, 'Verify session');
  const layout = h(
    'div',
    { class: 'layout' },
    h(
      'aside',
      { class: 'sidebar' },
      h('a', { href: '/', class: 'brand', onclick: (e) => { e.preventDefault(); navigate('/'); } }, h('img', { src: '/assets/wordmark.svg', alt: 'SunRey', width: '120', height: '18' })),
      h('nav', { class: 'nav', 'aria-label': 'Dashboard' }, navItems(route)),
      h('div', { class: 'sidebar-foot' }, h('p', null, 'Simulated environment. Not a bank account and not investment advice. No real money moves.')),
    ),
    h(
      'div',
      { class: 'content' },
      h(
        'header',
        { class: 'topbar' },
        h('div', { class: 'topbar-left' }, envBadge(CONFIG.environmentLabel), h('ul', { class: 'rail', 'aria-label': 'Environment' }, h('li', null, 'Simulated money'), h('li', null, 'Testnet assets'))),
        h(
          'div',
          { class: 'topbar-right' },
          strength,
          h('span', { class: 'user' }, session && session.email ? session.email : ''),
          h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => { await signOut(); render(); } }, 'Sign out'),
        ),
      ),
      h('div', { class: 'page' }, demoBanner(route), pageHead(route), main),
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
  document.body.classList.toggle('has-shell', Boolean(getSession()));
  if (!getSession()) {
    app.append(authScreen(() => navigate('/')));
    document.title = 'Sign in · SunRey';
    return;
  }
  const route = currentRoute();
  const { layout, main } = shell(route);
  app.append(layout);
  document.title = `${route.label} · SunRey`;
  window.scrollTo(0, 0);
  loadDecimals().finally(() => main.append(route.view({ navigate, refreshShell: render })));
}

window.addEventListener('popstate', render);
onSessionChange((s) => {
  if (!s) render();
});
render();
