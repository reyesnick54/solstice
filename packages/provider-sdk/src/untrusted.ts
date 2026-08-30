/**
 * Untrusted external input defenses.
 * All provider payloads are untrusted until validated and normalized.
 */

export const UNTRUSTED_INPUT_LIMITS = Object.freeze({
  maxJsonDepth: 32,
  maxStringLength: 1_048_576,
  maxArrayLength: 10_000,
  maxObjectKeys: 1_000,
  maxPayloadBytes: 5_242_880,
});

export type UntrustedPayloadRejectionCode =
  | 'PAYLOAD_TOO_LARGE'
  | 'JSON_DEPTH_EXCEEDED'
  | 'STRING_TOO_LONG'
  | 'ARRAY_TOO_LONG'
  | 'OBJECT_TOO_LARGE'
  | 'MALFORMED_JSON'
  | 'PROTOTYPE_POLLUTION'
  | 'UNSAFE_URL'
  | 'UNSAFE_TEXT';

export type UntrustedPayloadResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly code: UntrustedPayloadRejectionCode; readonly message: string };

const UNSAFE_URL_PROTOCOLS = /^(javascript|data|vbscript):/i;
const HTML_TAG = /<[^>]+>/;

export function parseUntrustedJson(payload: string | Buffer): UntrustedPayloadResult {
  const text = typeof payload === 'string' ? payload : payload.toString('utf8');
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > UNTRUSTED_INPUT_LIMITS.maxPayloadBytes) {
    return { ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'payload exceeds maximum size' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, code: 'MALFORMED_JSON', message: 'payload is not valid JSON' };
  }
  const depthCheck = validateDepth(parsed, 0);
  if (!depthCheck.ok) {
    return depthCheck;
  }
  return { ok: true, value: parsed };
}

export function sanitizeUntrustedText(text: string): {
  readonly text: string;
  readonly inert: true;
  readonly containsHtml: boolean;
  readonly treatedAsInstruction: false;
} {
  const containsHtml = HTML_TAG.test(text);
  const stripped = text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
  return Object.freeze({
    text: stripped,
    inert: true,
    containsHtml,
    treatedAsInstruction: false,
  });
}

export function validateSafeUrl(value: string): UntrustedPayloadResult {
  if (UNSAFE_URL_PROTOCOLS.test(value.trim())) {
    return { ok: false, code: 'UNSAFE_URL', message: 'unsafe URL protocol' };
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { ok: false, code: 'UNSAFE_URL', message: 'unsupported URL protocol' };
    }
    return { ok: true, value: parsed.toString() };
  } catch {
    return { ok: false, code: 'UNSAFE_URL', message: 'invalid URL' };
  }
}

function validateDepth(value: unknown, depth: number): UntrustedPayloadResult {
  if (depth > UNTRUSTED_INPUT_LIMITS.maxJsonDepth) {
    return { ok: false, code: 'JSON_DEPTH_EXCEEDED', message: 'JSON nesting too deep' };
  }
  if (typeof value === 'string' && value.length > UNTRUSTED_INPUT_LIMITS.maxStringLength) {
    return { ok: false, code: 'STRING_TOO_LONG', message: 'string exceeds maximum length' };
  }
  if (Array.isArray(value)) {
    if (value.length > UNTRUSTED_INPUT_LIMITS.maxArrayLength) {
      return { ok: false, code: 'ARRAY_TOO_LONG', message: 'array exceeds maximum length' };
    }
    for (const entry of value) {
      const child = validateDepth(entry, depth + 1);
      if (!child.ok) {
        return child;
      }
    }
    return { ok: true, value };
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length > UNTRUSTED_INPUT_LIMITS.maxObjectKeys) {
      return { ok: false, code: 'OBJECT_TOO_LARGE', message: 'object has too many keys' };
    }
    for (const key of keys) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return { ok: false, code: 'PROTOTYPE_POLLUTION', message: 'forbidden object key' };
      }
      const child = validateDepth(record[key], depth + 1);
      if (!child.ok) {
        return child;
      }
    }
  }
  return { ok: true, value };
}
