/**
 * Versioned validator economic policies.
 *
 * Production bond asset and minimum bond remain UNCONFIGURED unless a
 * human/governance authorization later records them. Development and
 * rehearsal values are fixtures only.
 */

import {
  economicsErr,
  economicsOk,
  type PolicyActor,
  type PolicyEnvironment,
  type ValidatorBondPolicy,
  type ValidatorEconomicPolicy,
  type ValidatorPenaltyPolicy,
  type ValidatorRewardPolicy,
  type EconomicsResult,
} from './types.ts';

export const DEVELOPMENT_BOND_ASSET_NOTES =
  'DEVELOPMENT FIXTURE. Development SunRey Coin units for local bonding only. Not a production bond asset.';

export const REHEARSAL_BOND_ASSET_NOTES =
  'REHEARSAL FIXTURE. Rehearsal-only SunRey Coin units. Not a production bond asset and not customer funds.';

export function developmentBondPolicy(version = 1): ValidatorBondPolicy {
  return Object.freeze({
    version,
    environment: 'development',
    bondAsset: 'DEVELOPMENT_SUNREY_COIN',
    bondAssetStatus: 'DEVELOPMENT_FIXTURE',
    minimumBond: 1_000_000n,
    minimumBondFixture: true,
    bondingDelayEpochs: 1n,
    unbondingDelayEpochs: 2n,
    accountabilityWindowEpochs: 2n,
    productionParametersConfigured: false,
    notes: DEVELOPMENT_BOND_ASSET_NOTES,
  });
}

export function rehearsalBondPolicy(version = 1): ValidatorBondPolicy {
  return Object.freeze({
    version,
    environment: 'rehearsal',
    bondAsset: 'REHEARSAL_SUNREY_COIN',
    bondAssetStatus: 'REHEARSAL_FIXTURE',
    minimumBond: 1_000_000n,
    minimumBondFixture: true,
    bondingDelayEpochs: 1n,
    unbondingDelayEpochs: 2n,
    accountabilityWindowEpochs: 2n,
    productionParametersConfigured: false,
    notes: REHEARSAL_BOND_ASSET_NOTES,
  });
}

export function productionBondPolicy(version = 1): ValidatorBondPolicy {
  return Object.freeze({
    version,
    environment: 'production',
    bondAsset: 'UNCONFIGURED',
    bondAssetStatus: 'UNCONFIGURED',
    minimumBond: 'UNCONFIGURED',
    minimumBondFixture: false,
    bondingDelayEpochs: 'UNCONFIGURED',
    unbondingDelayEpochs: 'UNCONFIGURED',
    accountabilityWindowEpochs: 2n,
    productionParametersConfigured: false,
    notes: 'Production bond asset remains UNCONFIGURED pending human/governance approval.',
  });
}

export function developmentRewardPolicy(version = 1): ValidatorRewardPolicy {
  return Object.freeze({
    version,
    environment: 'development',
    approvedSources: Object.freeze([
      'TRANSACTION_FEE_ALLOCATION',
      'EXPLICIT_VALIDATOR_REWARD_POOL',
      'MONETARY_POLICY_APPROVED_SOURCE',
    ]),
    voteWeight: 1n,
    proposalWeight: 2n,
    feeRewardShareBps: 2_500n,
    remainderDestination: 'NETWORK_SINK',
    hiddenInflation: false,
    notes: 'Integer participation × voting-power weights. Bond quantity does not become voting power.',
  });
}

export function developmentPenaltyPolicy(version = 1): ValidatorPenaltyPolicy {
  return Object.freeze({
    version,
    environment: 'development',
    rules: Object.freeze([
      Object.freeze({
        violationClass: 'DOUBLE_PROPOSAL' as const,
        requiredEvidence: 'DOUBLE_PROPOSAL' as const,
        bondImpactBps: 5_000n,
        rewardForfeit: true,
        jail: false,
        tombstone: true,
        policyVersion: version,
      }),
      Object.freeze({
        violationClass: 'DOUBLE_PREVOTE' as const,
        requiredEvidence: 'DOUBLE_PREVOTE' as const,
        bondImpactBps: 2_500n,
        rewardForfeit: true,
        jail: true,
        tombstone: false,
        policyVersion: version,
      }),
      Object.freeze({
        violationClass: 'DOUBLE_PRECOMMIT' as const,
        requiredEvidence: 'DOUBLE_PRECOMMIT' as const,
        bondImpactBps: 5_000n,
        rewardForfeit: true,
        jail: false,
        tombstone: true,
        policyVersion: version,
      }),
    ]),
    monitoringSuspicionInsufficient: true,
    notes: 'Protocol penalties require valid equivocation evidence. Suspicion cannot slash.',
  });
}

export function createEconomicPolicy(
  environment: PolicyEnvironment,
  version = 1,
  activationEpoch = 0n,
  activationHeight = 0n,
): ValidatorEconomicPolicy {
  const bond =
    environment === 'production'
      ? productionBondPolicy(version)
      : environment === 'rehearsal'
        ? rehearsalBondPolicy(version)
        : developmentBondPolicy(version);
  return Object.freeze({
    version,
    activationEpoch,
    activationHeight,
    environment,
    bond,
    reward: Object.freeze({ ...developmentRewardPolicy(version), environment }),
    penalty: Object.freeze({ ...developmentPenaltyPolicy(version), environment }),
    coinEqualsVote: false,
    publicDelegation: false,
    customerAssetsIsolated: true,
    aiMayAuthorize: false,
  });
}

export function policyAt(
  history: readonly ValidatorEconomicPolicy[],
  epoch: bigint,
): ValidatorEconomicPolicy {
  const applicable = history.filter((row) => row.activationEpoch <= epoch);
  if (applicable.length === 0) {
    throw new Error('no validator economic policy is active for the requested epoch');
  }
  return applicable.reduce((latest, row) => (row.activationEpoch >= latest.activationEpoch ? row : latest));
}

export function authorizePolicyUpdate(
  current: ValidatorEconomicPolicy,
  next: ValidatorEconomicPolicy,
  actor: PolicyActor,
): EconomicsResult<ValidatorEconomicPolicy> {
  if (actor.kind === 'AI' || actor.kind === 'AGENT' || actor.role === 'AI_PREPARER') {
    return economicsErr('AI_CANNOT_AUTHORIZE_ECONOMICS', 'AI cannot authorize validator economic policy');
  }
  if (!actor.governanceAuthorized || actor.kind !== 'HUMAN') {
    return economicsErr('UNAUTHORIZED_POLICY_UPDATE', 'validator economic policy requires canonical human governance');
  }
  if (next.version <= current.version) {
    return economicsErr('WRONG_POLICY_VERSION', 'policy version must increase');
  }
  if (next.activationEpoch < current.activationEpoch) {
    return economicsErr('WRONG_POLICY_VERSION', 'policy activation epoch must be monotonic');
  }
  if (next.coinEqualsVote !== false || next.publicDelegation !== false || next.aiMayAuthorize !== false) {
    return economicsErr('UNAUTHORIZED_POLICY_UPDATE', 'forbidden economic-policy flags');
  }
  if (next.environment === 'production' && next.bond.bondAsset !== 'UNCONFIGURED') {
    return economicsErr(
      'UNAUTHORIZED_POLICY_UPDATE',
      'production bond asset remains UNCONFIGURED until a later human/governance approval records it',
    );
  }
  return economicsOk(Object.freeze({ ...next }));
}
