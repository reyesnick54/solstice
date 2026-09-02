/**
 * Wave 3 — policy activation with governance-controlled monetary authorization.
 *
 * POLICY EXISTS ≠ POLICY IS ACTIVE ≠ POLICY IS AUTHORIZED FOR MONETARY USE.
 * AI, Oracle, and Exchange cannot activate monetary policy.
 */

import {
  isMonetaryPolicyType,
  MONETARY_POLICY_ACTIVATION_ACTOR_KINDS,
  type PolicyActivationActorKind,
  type PolicyRejectionCode,
} from './taxonomy.ts';
import { verifyGovernanceDecisionRef } from './governance.ts';
import { verifyPolicyDefinition } from './definition.ts';
import type { GovernanceDecisionRef, PolicyActivation, PolicyActivationResult, PolicyDefinition } from './types.ts';

export function canActivatePolicy(
  actorKind: PolicyActivationActorKind,
  policyType: PolicyDefinition['policyType'],
  authorizedForMonetaryUse: boolean,
): PolicyRejectionCode | null {
  if (actorKind === 'AI_PROPOSAL' || actorKind === 'AUTOMATION') {
    if (isMonetaryPolicyType(policyType) || authorizedForMonetaryUse) {
      return 'AI_CANNOT_ACTIVATE_MONETARY_POLICY';
    }
  }
  if (actorKind === 'ORACLE') {
    return 'ORACLE_CANNOT_ACTIVATE_POLICY';
  }
  if (actorKind === 'EXCHANGE') {
    return 'EXCHANGE_CANNOT_ACTIVATE_POLICY';
  }
  if (actorKind === 'VALIDATOR_GOVERNANCE') {
    return 'VALIDATOR_CANNOT_ACTIVATE_WITHOUT_PROTOCOL_GOVERNANCE';
  }
  if (
    (isMonetaryPolicyType(policyType) || authorizedForMonetaryUse) &&
    !(MONETARY_POLICY_ACTIVATION_ACTOR_KINDS as readonly string[]).includes(actorKind)
  ) {
    return 'AI_CANNOT_ACTIVATE_MONETARY_POLICY';
  }
  return null;
}

export function activatePolicy(input: {
  readonly definition: PolicyDefinition;
  readonly activationHeight: number;
  readonly actorKind: PolicyActivationActorKind;
  readonly actorId: string;
  readonly governanceAuthorizationRef: GovernanceDecisionRef;
  readonly authorizedForMonetaryUse: boolean;
  readonly activatedAt: string;
}): PolicyActivationResult {
  const definition = input.definition;

  if (!verifyPolicyDefinition(definition)) {
    return { ok: false, code: 'POLICY_CONTENT_HASH_MISMATCH', detail: 'definition hash invalid' };
  }
  if (definition.status !== 'REGISTERED') {
    return { ok: false, code: 'POLICY_NOT_REGISTERED', detail: `status=${definition.status}` };
  }
  if (!verifyGovernanceDecisionRef(input.governanceAuthorizationRef)) {
    return { ok: false, code: 'GOVERNANCE_REFERENCE_INVALID', detail: 'governance ref hash invalid' };
  }
  if (isMonetaryPolicyType(definition.policyType) && !input.governanceAuthorizationRef) {
    return { ok: false, code: 'GOVERNANCE_REFERENCE_REQUIRED', detail: 'monetary policy requires governance' };
  }

  const actorRejection = canActivatePolicy(
    input.actorKind,
    definition.policyType,
    input.authorizedForMonetaryUse,
  );
  if (actorRejection) {
    return { ok: false, code: actorRejection, detail: `actor=${input.actorKind}` };
  }

  const activation: PolicyActivation = Object.freeze({
    policyId: definition.policyId,
    policyType: definition.policyType,
    version: definition.version,
    contentHash: definition.contentHash,
    economy: definition.economy,
    activationHeight: input.activationHeight,
    effectiveFrom: definition.effectiveFrom,
    effectiveUntil: definition.effectiveUntil,
    status: 'ACTIVE',
    authorizedForMonetaryUse: input.authorizedForMonetaryUse,
    actorKind: input.actorKind,
    actorId: input.actorId,
    governanceAuthorizationRef: input.governanceAuthorizationRef,
    activatedAt: input.activatedAt,
  });

  return { ok: true, activation };
}

export function isPolicyActiveAt(activation: PolicyActivation, height: number): boolean {
  if (activation.status !== 'ACTIVE') {
    return false;
  }
  if (activation.activationHeight > height) {
    return false;
  }
  return true;
}

export function isAuthorizedForMonetaryUseAt(activation: PolicyActivation, height: number): boolean {
  return isPolicyActiveAt(activation, height) && activation.authorizedForMonetaryUse;
}
