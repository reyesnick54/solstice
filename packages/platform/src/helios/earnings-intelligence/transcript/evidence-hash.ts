import { createHash } from 'node:crypto';

export function hashTranscriptEvidence(payload: unknown): string {
  const canonical = JSON.stringify(payload, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
  return createHash('sha256').update(canonical).digest('hex');
}

export function shortEvidenceId(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);
}
