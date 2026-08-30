/**
 * Secret redaction for provider transport logs and errors.
 */

export const DEFAULT_SENSITIVE_HEADERS = [
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'api-key',
  'x-auth-token',
  'x-sunrey-signature',
] as const;

export const DEFAULT_SENSITIVE_QUERY_PARAMS = [
  'api_key',
  'apikey',
  'access_token',
  'token',
  'secret',
  'password',
  'client_secret',
] as const;

export const REDACTED = '[REDACTED]' as const;

export type RedactionCatalog = {
  readonly sensitiveHeaders: ReadonlySet<string>;
  readonly sensitiveQueryParams: ReadonlySet<string>;
};

export function createRedactionCatalog(input?: {
  readonly sensitiveHeaders?: readonly string[];
  readonly sensitiveQueryParams?: readonly string[];
}): RedactionCatalog {
  const headers = new Set<string>(DEFAULT_SENSITIVE_HEADERS);
  const queryParams = new Set<string>(DEFAULT_SENSITIVE_QUERY_PARAMS);
  for (const name of input?.sensitiveHeaders ?? []) {
    headers.add(name.toLowerCase());
  }
  for (const name of input?.sensitiveQueryParams ?? []) {
    queryParams.add(name.toLowerCase());
  }
  return Object.freeze({ sensitiveHeaders: headers, sensitiveQueryParams: queryParams });
}

export function redactHeaderRecord(
  headers: Readonly<Record<string, string>>,
  catalog: RedactionCatalog,
): Readonly<Record<string, string>> {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = catalog.sensitiveHeaders.has(key.toLowerCase()) ? REDACTED : value;
  }
  return Object.freeze(redacted);
}

export function redactUrlForLog(rawUrl: string, catalog: RedactionCatalog): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  for (const [name, value] of parsed.searchParams.entries()) {
    if (catalog.sensitiveQueryParams.has(name.toLowerCase())) {
      parsed.searchParams.set(name, REDACTED);
    } else if (value.length > 0 && looksLikeSecret(value)) {
      parsed.searchParams.set(name, REDACTED);
    }
  }
  return parsed.toString();
}

export function redactErrorMessage(message: string, secrets: readonly string[]): string {
  let safe = message;
  for (const secret of secrets) {
    if (secret.length >= 4) {
      safe = safe.split(secret).join(REDACTED);
    }
  }
  return safe;
}

function looksLikeSecret(value: string): boolean {
  if (value.length < 16) {
    return false;
  }
  const alnum = /^[A-Za-z0-9._~+/=-]+$/;
  return alnum.test(value);
}

export function headersAreSafeToLog(
  headers: Readonly<Record<string, string>>,
  catalog: RedactionCatalog,
): boolean {
  for (const [key, value] of Object.entries(headers)) {
    if (catalog.sensitiveHeaders.has(key.toLowerCase()) && value !== REDACTED && value.length > 0) {
      return false;
    }
  }
  return true;
}
