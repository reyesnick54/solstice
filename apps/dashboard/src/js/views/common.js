import { h, kv, badge } from '../ui.js';
import { humanize, money, dateTime } from '../format.js';

/** Grid container for a view. */
export function view(...children) {
  const frag = document.createDocumentFragment();
  for (const c of children.flat()) if (c) frag.append(c);
  return frag;
}

export function sectionTitle(text) {
  return h('h2', { class: 'section-title' }, text);
}

const MONEY_SHAPE = (v) => v && typeof v === 'object' && 'minorUnits' in v && 'currency' in v;
const HIDE = new Set(['schema', 'requestId', 'apiVersion']);

/**
 * Render the scalar fields of a backend object exactly as returned (money
 * objects formatted, booleans and enums humanised). Used for read models
 * whose schema is richer than this dashboard needs to interpret.
 */
export function autoKv(obj, { only, skip, limit = 14 } = {}) {
  if (!obj || typeof obj !== 'object') return h('p', { class: 'muted' }, '—');
  const keys = (only || Object.keys(obj)).filter((k) => !HIDE.has(k) && !(skip || []).includes(k));
  const pairs = [];
  for (const key of keys) {
    const v = obj[key];
    if (v === undefined) continue;
    if (MONEY_SHAPE(v)) pairs.push([humanize(key), money(v)]);
    else if (typeof v === 'boolean') pairs.push([humanize(key), h('span', { class: v ? 'flag flag-on' : 'flag' }, v ? 'On' : 'Off')]);
    else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) pairs.push([humanize(key), dateTime(v)]);
    else if (typeof v === 'string' && /^[A-Z][A-Z0-9_]+$/.test(v)) pairs.push([humanize(key), badge(v)]);
    else if (typeof v === 'string' || typeof v === 'number') pairs.push([humanize(key), String(v)]);
    else if (Array.isArray(v)) pairs.push([humanize(key), v.length === 0 ? 'None' : v.every((x) => typeof x !== 'object') ? v.map((x) => humanize(x)).join(', ') : `${v.length} item${v.length === 1 ? '' : 's'}`]);
    else if (v === null) pairs.push([humanize(key), '—']);
    if (pairs.length >= limit) break;
  }
  return kv(pairs);
}

/** Pull a list out of common response envelopes. */
export function items(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  for (const key of ['items', 'data', 'results', 'entries', 'orders', 'positions', 'holdings']) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}
