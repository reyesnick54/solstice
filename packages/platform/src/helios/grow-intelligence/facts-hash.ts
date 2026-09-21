import { createHash } from 'node:crypto';

export function hashGrowIntelligenceFacts(payload: unknown): string {
  const canonical = JSON.stringify(payload, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
  return createHash('sha256').update(canonical).digest('hex');
}
