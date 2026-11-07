/**
 * AAF entitlement gate — ALT02 blocks non-permitted alternative-data derived features.
 */

import {
  evaluateAlternativeDataFeatureGate,
  type AlternativeDataRightsRegistry,
  type PermittedPurpose,
} from '@solstice/provider-sdk';
import type { UtcInstant } from '@solstice/domain';

import type { FeatureEntitlementState } from './universal/types.ts';

export type Alt02FeatureGateInput = {
  readonly registry: AlternativeDataRightsRegistry;
  readonly providerId: string;
  readonly sourceId: string;
  readonly purpose: PermittedPurpose;
  readonly atUtc: UtcInstant;
};

export type Alt02FeatureGateResult = {
  readonly blocked: boolean;
  readonly entitlementState: FeatureEntitlementState;
  readonly outcome: string;
  readonly grantsExecutionAuthority: false;
};

export function applyAlt02FeatureEntitlementGate(input: Alt02FeatureGateInput): Alt02FeatureGateResult {
  const entry = input.registry.get(input.providerId, input.sourceId);
  if (!entry) {
    return Object.freeze({
      blocked: true,
      entitlementState: 'UNAVAILABLE',
      outcome: 'LICENSE_UNKNOWN',
      grantsExecutionAuthority: false,
    });
  }

  const decision = evaluateAlternativeDataFeatureGate({
    manifest: entry.manifest,
    revocation: entry.revocation,
    requestedPurpose: input.purpose,
    atUtc: input.atUtc,
  });

  if (!decision.allowed) {
    return Object.freeze({
      blocked: true,
      entitlementState: 'UNAVAILABLE',
      outcome: decision.outcome,
      grantsExecutionAuthority: false,
    });
  }

  return Object.freeze({
    blocked: false,
    entitlementState: 'USABLE',
    outcome: decision.outcome,
    grantsExecutionAuthority: false,
  });
}
