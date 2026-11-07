/**
 * Blocked placeholder when no rights manifest is registered — never infers license class.
 */

import type { AlternativeDataGateDecision } from './evaluate.ts';
import type { PermittedPurpose } from './taxonomy.ts';

export function blockedMissingAlternativeDataManifest(input: {
  readonly providerId: string;
  readonly sourceId: string;
  readonly requestedPurpose: PermittedPurpose;
}): AlternativeDataGateDecision {
  return Object.freeze({
    allowed: false,
    outcome: 'LICENSE_UNKNOWN',
    requestedPurpose: input.requestedPurpose,
    providerId: input.providerId,
    sourceId: input.sourceId,
    message: `no AlternativeDataRightsManifest registered for ${input.providerId}/${input.sourceId}`,
    grantsExecutionAuthority: false,
  });
}
