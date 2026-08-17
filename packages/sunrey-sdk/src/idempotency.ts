import { createHash } from 'node:crypto';

export type IdempotencyBinding = {
  readonly actor: string;
  readonly operation: string;
  readonly contentHash: string;
};

export function hashCanonicalContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function bindIdempotencyKey(input: {
  readonly actor: string;
  readonly operation: string;
  readonly canonicalContent: string;
}): IdempotencyBinding {
  return Object.freeze({
    actor: input.actor,
    operation: input.operation,
    contentHash: hashCanonicalContent(input.canonicalContent),
  });
}

export class IdempotencyStore {
  private readonly records = new Map<string, IdempotencyBinding & { readonly responseJson: string }>();

  remember(key: string, binding: IdempotencyBinding, responseJson: string): 'STORED' | 'REPLAY' | 'CONFLICT' {
    const existing = this.records.get(key);
    if (!existing) {
      this.records.set(key, Object.freeze({ ...binding, responseJson }));
      return 'STORED';
    }
    if (
      existing.actor !== binding.actor ||
      existing.operation !== binding.operation ||
      existing.contentHash !== binding.contentHash
    ) {
      return 'CONFLICT';
    }
    return 'REPLAY';
  }

  replay(key: string): string | undefined {
    return this.records.get(key)?.responseJson;
  }
}
