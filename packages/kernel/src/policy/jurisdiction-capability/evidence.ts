import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import type { CanPerformInput, CanPerformResult } from './types.ts';

export const JURISDICTION_CAPABILITY_DECISION_KIND = 'JURISDICTION_CAPABILITY_QUERY' as const;

export function sealCapabilityDecision(input: {
  readonly vault: EvidenceVault;
  readonly query: CanPerformInput;
  readonly result: CanPerformResult;
  readonly at: UtcInstant;
}): string {
  const recordId = `jcap-ev_${randomUUID()}`;
  input.vault.seal(
    JURISDICTION_CAPABILITY_DECISION_KIND,
    Object.freeze({
      recordId,
      occurredAt: input.at,
      jurisdiction: input.query.jurisdiction,
      legalEntityId: input.query.legalEntityId,
      customerId: input.query.customerId,
      customerClass: input.query.customerClass,
      productId: input.query.productId,
      action: input.query.action,
      accountId: input.query.accountId,
      providerId: input.query.providerId ?? null,
      environment: input.query.environment,
      outcome: input.result.outcome,
      policyVersion: input.result.policyVersion,
      capabilityId: input.result.capabilityId,
      capabilityStatus: input.result.capabilityStatus,
      reasonCodes: Object.freeze([...input.result.reasonCodes]),
      evidenceRefs: Object.freeze([...input.result.evidenceRefs]),
      resolvedOverlayId: input.result.resolvedOverlayId,
    }),
  );
  return recordId;
}
