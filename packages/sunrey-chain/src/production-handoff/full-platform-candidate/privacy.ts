/**
 * Scan generated artifacts for PII, raw credentials, keys, KYC bytes,
 * biometrics, Travel Rule plaintext, and raw personal economic data.
 * Public-chain evidence is commitments / references only.
 */

const FORBIDDEN_PATTERNS: readonly { readonly id: string; readonly pattern: RegExp }[] = [
  { id: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
  { id: 'passport', pattern: /\b[A-Z]{1,2}\d{7,9}\b/ },
  { id: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  { id: 'phone', pattern: /\b\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/ },
  { id: 'pem-key', pattern: /-----BEGIN ([A-Z ]*PRIVATE KEY|RSA PRIVATE KEY|EC PRIVATE KEY)-----/ },
  { id: 'raw-secret', pattern: /\b(sk_live_|sk_prod_|api[_-]?secret=|password=|Bearer [A-Za-z0-9._-]{20,})\b/i },
  { id: 'kyc-bytes', pattern: /\bkycDocumentBytes\b|\bbiometricTemplate\b/i },
  { id: 'travel-rule-plain', pattern: /\btravelRulePlaintext\b|\boriginatorFullName\b/i },
  { id: 'raw-peg', pattern: /\brawPersonalEconomicPayload\b/i },
];

const FORBIDDEN_KEYS = [
  'privateKey',
  'private_key',
  'secret',
  'password',
  'apiKey',
  'api_key',
  'mnemonic',
  'seedPhrase',
  'kycDocumentBytes',
  'biometricTemplate',
  'travelRulePlaintext',
  'rawPersonalEconomicPayload',
] as const;

export type PrivacyScanResult = {
  readonly clean: boolean;
  readonly publicChainPiiLeaks: number;
  readonly rawCredentialLeaks: number;
  readonly findings: readonly string[];
};

export function scanArtifacts(value: unknown): PrivacyScanResult {
  const findings: string[] = [];
  walk(value, 'root', findings);
  const text = safeText(value);
  for (const rule of FORBIDDEN_PATTERNS) {
    if (rule.pattern.test(text)) {
      findings.push(`pattern:${rule.id}`);
    }
  }
  const rawCredentialLeaks = findings.filter((row) => row.includes('secret') || row.includes('raw-secret') || row.includes('pem-key') || row.includes('apiKey') || row.includes('privateKey')).length;
  const publicChainPiiLeaks = findings.filter((row) => !row.includes('secret') && !row.includes('pem-key') && !row.includes('apiKey') && !row.includes('privateKey')).length;
  return Object.freeze({
    clean: findings.length === 0,
    publicChainPiiLeaks,
    rawCredentialLeaks,
    findings: Object.freeze(findings),
  });
}

function walk(value: unknown, path: string, findings: string[]): void {
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value === 'string') {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, findings));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if ((FORBIDDEN_KEYS as readonly string[]).includes(key)) {
        findings.push(`key:${key}@${path}`);
      }
      walk(inner, `${path}.${key}`, findings);
    }
  }
}

function safeText(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner));
  } catch {
    return String(value);
  }
}
