import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import type { AttackResult, CampaignReport, RangeEvidenceRecord } from './types.ts';

const SECRET_KEYS = [
  'privateKey',
  'private_key',
  'mnemonic',
  'seedPhrase',
  'rawKyc',
  'kycRecord',
  'pdvRaw',
  'personalDataVault',
  'consentDetail',
  'mandateSecret',
  'hsmMaterial',
] as const;

export function evidenceRecord(result: AttackResult): RangeEvidenceRecord {
  return {
    scenarioId: result.scenarioId,
    sourceCommit: result.sourceCommit,
    testnetGenesis: result.testnetGenesis,
    result: redact(result),
    invariants: result.invariants,
    alerts: result.detections.filter((row) => row.observed).map((row) => `${row.channel}:${row.code}`),
    recovery: result.recovery,
    secretsPresent: false,
  };
}

export function redact<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (key, inner) => {
    if (SECRET_KEYS.includes(key as (typeof SECRET_KEYS)[number])) {
      return '[REDACTED]';
    }
    if (typeof inner === 'string' && /(mnemonic|private[_ ]?key|seed phrase)/i.test(inner)) {
      return '[REDACTED]';
    }
    return inner;
  })) as T;
}

export function containsSecrets(value: unknown): boolean {
  const raw = JSON.stringify(value);
  return SECRET_KEYS.some((key) => new RegExp(`"${key}":\\s*"(?!\\[REDACTED\\])`).test(raw));
}

export function writeEvidenceArtifact(path: string, record: RangeEvidenceRecord | CampaignReport): void {
  mkdirSync(dirname(path), { recursive: true });
  const safe = redact(record);
  if (containsSecrets(safe)) {
    throw new Error('refusing to write evidence that still contains secrets');
  }
  writeFileSync(path, `${JSON.stringify(safe, jsonReplacer, 2)}\n`);
}

function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}
