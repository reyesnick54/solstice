import type { Opportunity } from './types.ts';
import type { OpportunityCategory } from './taxonomy.ts';

export const MAX_PRESENTED = 5;
export const MAX_PER_CATEGORY = 2;
export const DISMISSAL_MATERIAL_BPS = 2000;

export function fingerprintOf(detector: string, category: string, currency: string, anchor: string): string {
  return `${detector}|${category}|${currency}|${anchor}`;
}

export function shouldSuppress(input: {
  readonly fingerprint: string;
  readonly previous: readonly Opportunity[];
  readonly nextEstimatedMinor?: string;
}): { readonly suppress: boolean; readonly reason?: string } {
  const prior = input.previous.find((item) => item.fingerprint === input.fingerprint);
  if (!prior) {
    return { suppress: false };
  }
  if (prior.status === 'DISMISSED' || prior.status === 'SUPERSEDED' || prior.status === 'COMPLETED') {
    if (prior.status === 'DISMISSED' && input.nextEstimatedMinor && prior.estimatedImpact) {
      const previous = BigInt(prior.estimatedImpact.minorUnits);
      const next = BigInt(input.nextEstimatedMinor);
      if (previous > 0n) {
        const change = ((next > previous ? next - previous : previous - next) * 10000n) / previous;
        if (change >= BigInt(DISMISSAL_MATERIAL_BPS)) {
          return { suppress: false };
        }
      }
    }
    return { suppress: true, reason: `fingerprint ${input.fingerprint} is ${prior.status}` };
  }
  return { suppress: false };
}

export function applyDiversity(items: readonly Opportunity[]): {
  readonly presented: readonly Opportunity[];
  readonly suppressed: readonly Opportunity[];
} {
  const presented: Opportunity[] = [];
  const suppressed: Opportunity[] = [];
  const perCategory = new Map<OpportunityCategory, number>();
  for (const item of items) {
    if (item.status !== 'ELIGIBLE' && item.status !== 'PRESENTED' && item.status !== 'DETECTED') {
      suppressed.push(item);
      continue;
    }
    if (!item.eligible) {
      suppressed.push(item);
      continue;
    }
    const count = perCategory.get(item.type) ?? 0;
    if (count >= MAX_PER_CATEGORY || presented.length >= MAX_PRESENTED) {
      suppressed.push(item);
      continue;
    }
    perCategory.set(item.type, count + 1);
    presented.push({ ...item, status: 'PRESENTED' });
  }
  return {
    presented: Object.freeze(presented),
    suppressed: Object.freeze(suppressed),
  };
}

export function unusedCategory(_category: OpportunityCategory): true {
  return true;
}
