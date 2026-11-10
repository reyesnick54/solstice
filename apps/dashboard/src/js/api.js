// SunRey dashboard API client.
//
// - Talks only to the canonical Consumer BFF (/api/v1). No financial state is
//   computed or stored here; every number on screen comes from a response.
// - Bearer tokens live in sessionStorage (cleared when the tab closes), never
//   localStorage. No cookies are used, so cross-site request forgery does not
//   apply; the API's CORS allowlist and the page CSP limit who can call it.
// - Every write carries an Idempotency-Key so a double-click or retry cannot
//   duplicate a financial action.

import { CONFIG } from './config.js';

const STORE_KEY = 'sunrey.dashboard.session.v1';

export class ApiError extends Error {
  constructor(status, body) {
    super((body && body.message) || `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = (body && body.errorCode) || (status === 0 ? 'NETWORK' : 'UNKNOWN');
    this.category = body && body.category;
    this.details = (body && body.detailsSafeForClient) || {};
    this.requestId = body && body.requestId;
    this.body = body;
  }
}

// Customer-facing wording for known backend codes (shared with the mobile app).
const CODE_MESSAGES = {
  AUTH_REQUIRED: 'Please sign in again.',
  SESSION_INVALID: 'Your session ended. Please sign in again.',
  KERNEL_REFUSED: 'The Compliance Kernel did not authorise this action.',
  KERNEL_DENIED: 'The Compliance Kernel did not authorise this action.',
  STEP_UP_REQUIRED: 'Confirm with your authenticator code to continue.',
  INSUFFICIENT_FUNDS: "There isn't enough available balance in that account.",
  BALANCE_INSUFFICIENT: "There isn't enough available balance in that account.",
  INSUFFICIENT_AVAILABLE_CAPITAL: "There isn't enough available capital for this.",
  RESOURCE_NOT_OWNED: 'That item belongs to a different customer.',
  CAPABILITY_DISABLED: 'This capability is not enabled for your account yet.',
  FEATURE_UNAVAILABLE: 'This feature is not available in this environment.',
  REGULATED_FEATURE_DISABLED: 'This regulated feature is switched off until it is licensed and approved.',
  SANDBOX_ONLY: 'This works in the sandbox only.',
  PROVIDER_UNAVAILABLE: 'The provider for this service is unavailable right now.',
  SERVICE_DEGRADED: 'Too many attempts, or the service is degraded. Try again shortly.',
  VALIDITY_EXPIRED: 'That quote has expired. Request a new one.',
  FORBIDDEN: "Your account doesn't have permission for this yet.",
  CONSENT_REQUIRED: 'This needs your consent first.',
  VALIDATION: 'Please check the details and try again.',
  NETWORK: "We couldn't reach SunRey. Check your connection and try again.",
};

export function friendlyMessage(error) {
  if (!(error instanceof ApiError)) return 'Something went wrong.';
  if (error.code === 'VALIDATION' && error.body && error.body.message) return capitalise(error.body.message);
  return CODE_MESSAGES[error.code] || capitalise(error.message);
}

function capitalise(text) {
  const s = String(text || '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---- session -------------------------------------------------------------

let session = load();
const listeners = new Set();

function load() {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save(next) {
  session = next;
  try {
    if (next) sessionStorage.setItem(STORE_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(STORE_KEY);
  } catch {
    /* storage unavailable: session lives in memory for this tab */
  }
  for (const fn of listeners) fn(session);
}

export function getSession() {
  return session;
}

export function onSessionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setTokens(bundle, extra = {}) {
  save({
    accessToken: bundle.accessToken,
    refreshToken: bundle.refreshToken,
    accessExpiresAt: bundle.accessExpiresAt,
    strength: bundle.authenticationStrength,
    ...extra,
  });
}

export function clearSession() {
  save(null);
}

// ---- transport -----------------------------------------------------------

function newIdempotencyKey(prefix) {
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  return `${prefix}-${id}`;
}

async function raw(method, path, { body, idempotency, auth = true, signal } = {}) {
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (auth && session && session.accessToken) headers.authorization = `Bearer ${session.accessToken}`;
  if (idempotency) headers['idempotency-key'] = idempotency;
  let response;
  try {
    response = await fetch(`${CONFIG.apiBase}/api/v1${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'omit',
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    if (error && error.name === 'AbortError') throw error;
    throw new ApiError(0, null);
  }
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text.slice(0, 200) };
  }
  if (!response.ok) throw new ApiError(response.status, json);
  return { data: json, headers: response.headers, status: response.status };
}

let refreshing = null;

async function refreshOnce() {
  if (!session || !session.refreshToken) return false;
  if (!refreshing) {
    refreshing = raw('POST', '/auth/refresh', { body: { refreshToken: session.refreshToken }, auth: false })
      .then(({ data }) => {
        // A refreshed session keeps its assurance only if the server says so.
        setTokens(data, { email: session && session.email });
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function request(method, path, options = {}) {
  try {
    return await raw(method, path, options);
  } catch (error) {
    const expired = error instanceof ApiError && (error.code === 'SESSION_INVALID' || error.code === 'AUTH_REQUIRED');
    if (expired && options.auth !== false && session && session.refreshToken && !options._retried) {
      if (await refreshOnce()) return raw(method, path, { ...options, _retried: true });
      clearSession();
    } else if (expired && options.auth !== false) {
      clearSession();
    }
    throw error;
  }
}

export const api = {
  get: (path, opts) => request('GET', path, opts).then((r) => r.data),
  // Writes always carry an idempotency key; callers may pass a stable one.
  post: (path, body = {}, opts = {}) =>
    request('POST', path, { ...opts, body, idempotency: opts.idempotency || newIdempotencyKey('dash') }),
  newIdempotencyKey,
};
