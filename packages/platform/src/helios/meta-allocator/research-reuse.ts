import type { PublicResearchReuseRecord } from './types.ts';
import type { ResearchReuseRights } from './taxonomy.ts';
import type { UtcInstant } from '@solstice/domain';

export function validatePublicResearchReuse(
  reuse: PublicResearchReuseRecord,
  customerId: string,
  now: UtcInstant,
): { readonly ok: true; readonly marginalCostMinor: string } | { readonly ok: false; readonly reason: string } {
  if (reuse.customerContextLeaked !== false) {
    return { ok: false, reason: 'customer context must not leak through public research reuse' };
  }
  if (reuse.rights === 'CUSTOMER_PRIVATE') {
    return { ok: false, reason: 'private research cannot be reused across customers' };
  }
  if (reuse.rights === 'UNAVAILABLE') {
    return { ok: false, reason: 'research reuse rights unavailable' };
  }
  if (now > reuse.freshnessExpiresAt) {
    return { ok: false, reason: 'public research freshness expired' };
  }
  if (reuse.rights !== 'PUBLIC' && reuse.rights !== 'LICENSED') {
    return { ok: false, reason: 'unsupported reuse rights' };
  }
  void customerId;
  return { ok: true, marginalCostMinor: reuse.marginalCostMinor };
}

export function sanitizeReuseForCustomer(
  reuse: PublicResearchReuseRecord,
  customerId: string,
): PublicResearchReuseRecord {
  return Object.freeze({
    reuseId: reuse.reuseId,
    sourceResearchId: reuse.sourceResearchId,
    provenanceRef: reuse.provenanceRef,
    rights: reuse.rights,
    marginalCostMinor: reuse.marginalCostMinor,
    freshnessExpiresAt: reuse.freshnessExpiresAt,
    customerContextLeaked: false,
  });
}

export function rightsPermitReuse(rights: ResearchReuseRights): boolean {
  return rights === 'PUBLIC' || rights === 'LICENSED';
}
