/**
 * Privacy and data minimization guards for risk evidence.
 */

const FORBIDDEN_PAYLOAD_KEYS = Object.freeze([
  'healthData',
  'dna',
  'vaultContents',
  'hinContents',
  'agentReasoning',
  'financialAgentPrivateReasoning',
  'rawEmail',
  'rawIp',
  'documentImage',
  'biometricTemplate',
] as const);

const FORBIDDEN_DOMAIN_MARKERS = Object.freeze(['hin:', 'pdv:', 'vault:', 'peg:'] as const);

export function assertRiskEvidencePayloadMinimized(payload: unknown): void {
  const serialized = JSON.stringify(payload ?? {});
  for (const key of FORBIDDEN_PAYLOAD_KEYS) {
    if (serialized.includes(`"${key}"`)) {
      throw new Error(`forbidden data in risk evidence payload: ${key}`);
    }
  }
  for (const marker of FORBIDDEN_DOMAIN_MARKERS) {
    if (serialized.includes(marker)) {
      throw new Error(`forbidden domain data in risk evidence payload: ${marker}`);
    }
  }
}

export function redactIpForLog(ip: string | null): string {
  if (!ip) return '[redacted]';
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.xxx.xxx`;
  }
  return '[redacted]';
}

export function redactEmailForLog(email: string | null): string {
  if (!email) return '[redacted]';
  const at = email.indexOf('@');
  if (at <= 0) return '[redacted]';
  return `***@${email.slice(at + 1)}`;
}

export function buildProviderOutboundPayload(input: {
  readonly ipHash?: string;
  readonly emailHash?: string;
  readonly companyName?: string;
  readonly registrationNumber?: string;
  readonly jurisdiction?: string;
}): Readonly<Record<string, string>> {
  const payload: Record<string, string> = {};
  if (input.ipHash) payload.ipHash = input.ipHash;
  if (input.emailHash) payload.emailHash = input.emailHash;
  if (input.companyName) payload.companyName = input.companyName;
  if (input.registrationNumber) payload.registrationNumber = input.registrationNumber;
  if (input.jurisdiction) payload.jurisdiction = input.jurisdiction;
  assertRiskEvidencePayloadMinimized(payload);
  return Object.freeze(payload);
}
