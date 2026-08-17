import { createHash } from 'node:crypto';

export function infraSha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

export function digestJson(value: unknown): string {
  return infraSha256(stableJson(value));
}
