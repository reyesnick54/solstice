// DOM helpers and shared state components. Text is always set with
// textContent; nothing from the API is ever parsed as HTML.

import { ApiError, friendlyMessage } from './api.js';
import { humanize } from './format.js';

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key === 'dataset') Object.assign(el.dataset, value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
      else if (key === 'text') el.textContent = value;
      else el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function svg(tag, attrs, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
  for (const c of children.flat()) if (c) el.append(c);
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

// ---- badges --------------------------------------------------------------

const TONE = {
  SANDBOX: 'info',
  SIMULATION: 'info',
  TESTNET: 'info',
  PAPER: 'info',
  LIVE: 'positive',
  LIVE_ALPHA: 'info',
  ACTIVE: 'positive',
  OPEN: 'positive',
  VERIFIED: 'positive',
  POSTED: 'positive',
  SETTLED: 'positive',
  FILLED: 'positive',
  FINALIZED: 'positive',
  PENDING: 'warning',
  PENDING_APPROVAL: 'warning',
  IN_PROGRESS: 'warning',
  RESTRICTED: 'negative',
  REJECTED: 'negative',
  BLOCKED: 'negative',
  CANCELLED: 'muted',
  UNAVAILABLE: 'muted',
  DISABLED: 'muted',
};

export function badge(text, tone) {
  const t = tone || TONE[String(text).toUpperCase()] || 'muted';
  return h('span', { class: `badge badge-${t}` }, humanize(text));
}

export function envBadge(label = 'Sandbox') {
  return h('span', { class: 'badge badge-env', title: 'Simulated environment. No real money moves.' }, label);
}

// ---- panel with states ---------------------------------------------------

/**
 * A panel that loads data and renders exactly one of: loading, error,
 * unavailable (capability disabled / not bound), empty, or content.
 */
export function panel({ title, subtitle, actions, className, load, render, empty, wide }) {
  const body = h('div', { class: 'panel-body' });
  const root = h(
    'section',
    { class: `panel ${wide ? 'panel-wide' : ''} ${className || ''}` },
    h('header', { class: 'panel-head' }, h('div', null, h('h3', null, title), subtitle ? h('p', { class: 'muted small' }, subtitle) : null), actions ? h('div', { class: 'panel-actions' }, actions) : null),
    body,
  );
  async function refresh() {
    clear(body).append(loading());
    try {
      const data = await load();
      clear(body);
      const isEmpty = typeof empty === 'function' ? empty(data) : false;
      if (isEmpty) body.append(emptyState(typeof isEmpty === 'string' ? isEmpty : 'Nothing here yet.'));
      else body.append(render(data, refresh));
    } catch (error) {
      clear(body).append(errorState(error, refresh));
    }
  }
  root.refresh = refresh;
  refresh();
  return root;
}

export function loading(label = 'Loading') {
  return h('div', { class: 'state state-loading', role: 'status', 'aria-live': 'polite' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), label);
}

export function emptyState(text) {
  return h('div', { class: 'state state-empty' }, text);
}

const UNAVAILABLE_CODES = new Set([
  'CAPABILITY_DISABLED',
  'FEATURE_UNAVAILABLE',
  'REGULATED_FEATURE_DISABLED',
  'PROVIDER_UNAVAILABLE',
  'SANDBOX_ONLY',
  'NOT_FOUND',
]);

export function errorState(error, retry) {
  if (error instanceof ApiError && UNAVAILABLE_CODES.has(error.code)) {
    const reason = error.details && (error.details.growCode || error.details.reason || error.details.code);
    return h(
      'div',
      { class: 'state state-unavailable' },
      h('strong', null, 'Not available for your account yet'),
      h('p', null, error.code === 'NOT_FOUND' ? 'This service is not exposed by the current backend release.' : friendlyMessage(error)),
      reason ? h('p', { class: 'muted small mono' }, `Backend: ${error.code} · ${reason}`) : h('p', { class: 'muted small mono' }, `Backend: ${error.code}`),
    );
  }
  if (error instanceof ApiError && error.code === 'RESOURCE_NOT_OWNED') {
    // The backend uses this when the resource (e.g. a wallet or vault actor
    // context) has not been created for this customer yet.
    return h(
      'div',
      { class: 'state state-unavailable' },
      h('strong', null, 'Not set up for your account yet'),
      h('p', null, 'Create it first (for example a wallet), or this service is not yet bound to self-registered accounts.'),
      h('p', { class: 'muted small mono' }, `Backend: ${error.code}${error.body && error.body.message ? ' · ' + error.body.message : ''}`),
    );
  }
  if (error instanceof ApiError && error.code === 'FORBIDDEN' && error.details && error.details.requiredCapability) {
    return h(
      'div',
      { class: 'state state-unavailable' },
      h('strong', null, 'Permission not granted'),
      h('p', null, `This needs the ${humanize(error.details.requiredCapability)} permission, which your account does not have.`),
    );
  }
  return h(
    'div',
    { class: 'state state-error', role: 'alert' },
    h('strong', null, "Couldn't load this"),
    h('p', null, friendlyMessage(error)),
    error instanceof ApiError && error.requestId ? h('p', { class: 'muted small mono' }, `Request ${error.requestId}`) : null,
    retry ? h('button', { class: 'btn btn-ghost btn-sm', onclick: retry }, 'Try again') : null,
  );
}

// ---- tables / key-value ---------------------------------------------------

export function table(columns, rows, { onRow } = {}) {
  return h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      { class: 'data-table' },
      h('thead', null, h('tr', null, columns.map((c) => h('th', { class: c.align === 'right' ? 'num' : '' }, c.label)))),
      h(
        'tbody',
        null,
        rows.map((row) =>
          h(
            'tr',
            onRow ? { class: 'clickable', tabindex: '0', onclick: () => onRow(row), onkeydown: (e) => e.key === 'Enter' && onRow(row) } : null,
            columns.map((c) => {
              const v = c.render ? c.render(row) : row[c.key];
              return h('td', { class: c.align === 'right' ? 'num' : '' }, v === undefined || v === null || v === '' ? '—' : v);
            }),
          ),
        ),
      ),
    ),
  );
}

export function kv(pairs) {
  return h(
    'dl',
    { class: 'kv' },
    pairs.filter(Boolean).map(([k, v]) => [h('dt', null, k), h('dd', null, v === undefined || v === null || v === '' ? '—' : v)]),
  );
}

export function stat(label, value, note, tone) {
  return h('div', { class: `stat ${tone ? 'stat-' + tone : ''}` }, h('span', { class: 'stat-label' }, label), h('span', { class: 'stat-value' }, value), note ? h('span', { class: 'stat-note' }, note) : null);
}

export function note(text, tone = 'info') {
  return h('p', { class: `note note-${tone}` }, text);
}

// ---- forms / dialogs -------------------------------------------------------

export function field(label, input, hint) {
  const id = input.id || `f-${Math.random().toString(36).slice(2, 9)}`;
  input.id = id;
  return h('label', { class: 'field', for: id }, h('span', { class: 'field-label' }, label), input, hint ? h('span', { class: 'field-hint' }, hint) : null);
}

export function toast(text, tone = 'info') {
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = h('div', { class: `toast toast-${tone}`, role: 'status' }, text);
  host.append(el);
  setTimeout(() => el.classList.add('toast-out'), 4200);
  setTimeout(() => el.remove(), 4800);
}

export function dialog({ title, content, onClose }) {
  const box = h(
    'div',
    { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', { class: 'dialog-head' }, h('h3', null, title), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => close() }, '×')),
    h('div', { class: 'dialog-body' }, content),
  );
  const backdrop = h('div', { class: 'backdrop', onclick: (e) => e.target === backdrop && close() }, box);
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  function close() {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    if (onClose) onClose();
  }
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  const first = box.querySelector('input, select, textarea, button.btn');
  if (first) setTimeout(() => first.focus(), 30);
  return { close, box };
}

/** Run an async action from a button with busy state and error toast. */
export async function act(button, fn) {
  if (button) {
    if (button.disabled) return undefined;
    button.disabled = true;
    button.dataset.label = button.textContent;
    button.textContent = 'Working…';
  }
  try {
    return await fn();
  } catch (error) {
    toast(friendlyMessage(error), 'negative');
    return undefined;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.label || button.textContent;
    }
  }
}
