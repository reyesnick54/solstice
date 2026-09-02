/**
 * Structured log redaction for tokens, secrets, PII, health, financial,
 * consent documents, and private keys. Complements services/api logging.
 */

export const REDACTED = '[REDACTED]' as const;

const SENSITIVE_KEY_RE =
  /pass(word|wd)?|secret|token|refresh|authorization|private[_-]?key|seed|mnemonic|ssn|pan|card([_-]?number)?|cvv|cvc|api[_-]?key|hmac|cookie|iban|routing|account([_-]?number)?|hin([_-]?data)?|health([_-]?data|record)?|diagnosis|medical|phi|consent([_-]?document)?|prompt([_-]?context)?|dateOfBirth|birthDate|transcript|vaultContents|financialDetails?|email|phone|mobile|governmentId|nationalId|location([_-]?history)?|gps|dna|genetic|psychological|communications?/i;

const SENSITIVE_VALUE_RE =
  /bearer\s+[a-z0-9._~+/=-]+|eyj[a-z0-9_-]+\.[a-z0-9_-]+|sk_[a-z0-9]+|-----begin [a-z ]+private key-----/i;

export function shouldRedactKey(key: string): boolean {
  return SENSITIVE_KEY_RE.test(key);
}

export function shouldRedactValue(value: unknown): boolean {
  return typeof value === 'string' && SENSITIVE_VALUE_RE.test(value);
}

export function redactLogValue(key: string, value: unknown): unknown {
  if (shouldRedactKey(key)) {
    return REDACTED;
  }
  if (shouldRedactValue(value)) {
    return REDACTED;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => redactLogValue(String(index), item));
  }
  if (value && typeof value === 'object') {
    return redactLogRecord(value as Record<string, unknown>);
  }
  return value;
}

export function redactLogRecord(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = redactLogValue(key, value);
  }
  return Object.freeze(out);
}

export function safeLogLine(input: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(redactLogRecord(input));
}

export function assertLogPayloadSafe(input: Readonly<Record<string, unknown>>): void {
  const line = JSON.stringify(input);
  if (SENSITIVE_VALUE_RE.test(line)) {
    throw new Error('log payload contains sensitive value patterns');
  }
  for (const key of Object.keys(input)) {
    if (shouldRedactKey(key) && input[key] !== REDACTED) {
      throw new Error(`log payload contains sensitive key without redaction: ${key}`);
    }
  }
}
