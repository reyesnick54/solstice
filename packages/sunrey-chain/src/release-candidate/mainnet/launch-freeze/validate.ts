import { allCriticalVersionsExplicit, rejectFloatingComponentVersions } from './bindings.ts';
import { launchFreezeContainsPrivateKey, launchFreezeContainsSecret } from './hash.ts';
import {
  type LaunchFreezeBlockerCode,
  type ProductionLaunchCandidateFreeze,
  type ProductionLaunchCandidateFreezeInput,
} from './types.ts';

export function validateLaunchFreezeInput(input: ProductionLaunchCandidateFreezeInput): readonly LaunchFreezeBlockerCode[] {
  const blockers: LaunchFreezeBlockerCode[] = [];
  const floating = rejectFloatingComponentVersions(input.bindings);
  if (floating.length > 0 || !allCriticalVersionsExplicit(input.bindings)) {
    blockers.push('FLOATING_VERSION_REJECTED');
  }
  if (launchFreezeContainsSecret(input)) {
    blockers.push('SECRET_VALUE_REJECTED');
  }
  if (launchFreezeContainsPrivateKey(input)) {
    blockers.push('PRIVATE_KEY_REJECTED');
  }
  if (!input.productionParametersComplete) {
    blockers.push('PRODUCTION_PARAMETERS_UNCONFIGURED');
  }
  if (!input.externalEvidenceComplete) {
    blockers.push('EXTERNAL_EVIDENCE_INCOMPLETE');
  }
  if (input.fixtureEvidenceUsed) {
    blockers.push('FIXTURE_EVIDENCE_CANNOT_SATISFY_PRODUCTION');
  }
  if (!input.humanAuthorizationComplete) {
    blockers.push('HUMAN_AUTHORIZATION_INCOMPLETE');
  }
  if (input.engineeringValidated === false) {
    blockers.push('ENGINEERING_NOT_VALIDATED');
  }
  if (
    !input.productionParametersComplete ||
    !input.externalEvidenceComplete ||
    !input.humanAuthorizationComplete ||
    input.fixtureEvidenceUsed
  ) {
    blockers.push('INCOMPLETE_REVIEW_CANDIDATE');
  }
  if (input.requestFrozenForReview === true && blockers.includes('INCOMPLETE_REVIEW_CANDIDATE')) {
    blockers.push('FREEZE_FOR_REVIEW_REQUIRES_COMPLETE_INPUTS');
  }
  return Object.freeze([...new Set(blockers)]);
}

export function assertLaunchFreezeImmutable(freeze: ProductionLaunchCandidateFreeze): void {
  if (!Object.isFrozen(freeze)) {
    throw new TypeError('launch freeze must be immutable');
  }
  if (!Object.isFrozen(freeze.bindings)) {
    throw new TypeError('launch freeze bindings must be immutable');
  }
}

export function attemptMutateFrozenLaunchCandidate(
  freeze: ProductionLaunchCandidateFreeze,
  _patch: Partial<ProductionLaunchCandidateFreeze>,
): never {
  assertLaunchFreezeImmutable(freeze);
  throw new TypeError('frozen launch candidate is immutable; assemble a new freezeId, version, and hash');
}

export function rejectSecretValue(value: unknown): void {
  if (launchFreezeContainsSecret(value)) {
    throw new TypeError('SECRET_VALUE_REJECTED');
  }
}

export function rejectPrivateKey(value: unknown): void {
  if (launchFreezeContainsPrivateKey(value)) {
    throw new TypeError('PRIVATE_KEY_REJECTED');
  }
}

export function attemptMintFromLaunchFreeze(): 'MINT_FORBIDDEN' {
  return 'MINT_FORBIDDEN';
}

export function attemptIssueAuthorityFromLaunchFreeze(): 'EXECUTION_AUTHORITY_FORBIDDEN' {
  return 'EXECUTION_AUTHORITY_FORBIDDEN';
}

export function attemptEnableMainnetFromLaunchFreeze(): 'MAINNET_ENABLE_FORBIDDEN' {
  return 'MAINNET_ENABLE_FORBIDDEN';
}

export function attemptActivateProductionFromLaunchFreeze(): 'PRODUCTION_ACTIVATION_FORBIDDEN' {
  return 'PRODUCTION_ACTIVATION_FORBIDDEN';
}
