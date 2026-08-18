/**
 * Supply, validator-economics, fee-market, MoonRey, and treasury audits.
 *
 * Money remains integer minor units. Genesis does not authorize treasury
 * spending. Productive MoonRey issuance remains explicitly disabled until
 * its own capability package is independently activated.
 */

import type {
  FeeMarketSample,
  PostGenesisCheckpoint,
  PostGenesisEconomicAudit,
  PostGenesisValidatorAudit,
} from './types.ts';

export type SupplyObservation = {
  readonly sunreySupplyMinor: bigint;
  readonly moonreySupplyMinor: bigint;
  readonly burnedMinor: bigint;
  readonly lockedMinor: bigint;
  readonly escrowedMinor: bigint;
  readonly feeReservedMinor: bigint;
};

export type ValidatorEconomicObservation = {
  readonly bondedMinor: bigint;
  readonly rewardsMinor: bigint;
  readonly penaltiesMinor: bigint;
  readonly feeRewardAllocatedMinor: bigint;
};

export function rehearsalSupply(): SupplyObservation {
  return Object.freeze({
    sunreySupplyMinor: 1_000_000n,
    moonreySupplyMinor: 0n,
    burnedMinor: 0n,
    lockedMinor: 0n,
    escrowedMinor: 0n,
    feeReservedMinor: 0n,
  });
}

export function rehearsalValidatorEconomics(): ValidatorEconomicObservation {
  return Object.freeze({
    bondedMinor: 210_000n,
    rewardsMinor: 25n,
    penaltiesMinor: 0n,
    feeRewardAllocatedMinor: 25n,
  });
}

export function auditSupply(
  checkpoint: PostGenesisCheckpoint,
  observation: SupplyObservation,
): PostGenesisEconomicAudit {
  const accounted =
    observation.burnedMinor + observation.lockedMinor + observation.escrowedMinor + observation.feeReservedMinor;
  const findings: string[] = [];
  if (observation.sunreySupplyMinor < 0n || observation.moonreySupplyMinor < 0n) {
    findings.push('supply cannot be negative');
  }
  if (accounted > observation.sunreySupplyMinor + observation.moonreySupplyMinor) {
    findings.push('reserved or locked quantity exceeds recorded supply');
  }
  return Object.freeze({
    checkpointId: checkpoint.checkpointId,
    coordinate: checkpoint.coordinate,
    ...observation,
    conserved: findings.length === 0,
    findings: Object.freeze(findings),
  });
}

export function auditValidatorEconomics(
  checkpoint: PostGenesisCheckpoint,
  observation: ValidatorEconomicObservation,
): PostGenesisValidatorAudit {
  const findings: string[] = [];
  if (observation.rewardsMinor < 0n || observation.penaltiesMinor < 0n || observation.bondedMinor < 0n) {
    findings.push('validator economics cannot be negative');
  }
  if (observation.feeRewardAllocatedMinor > observation.rewardsMinor) {
    findings.push('fee reward allocation exceeds recorded rewards');
  }
  return Object.freeze({
    checkpointId: checkpoint.checkpointId,
    coordinate: checkpoint.coordinate,
    ...observation,
    conserved: findings.length === 0,
    findings: Object.freeze(findings),
  });
}

export function moonreyIssuanceState(activated: boolean): {
  readonly productiveIssuance: 'EXPLICITLY_DISABLED' | 'PACKAGE_REQUIRED';
  readonly requiresOwnCapabilityPackage: true;
} {
  return Object.freeze({
    productiveIssuance: activated ? 'PACKAGE_REQUIRED' : 'EXPLICITLY_DISABLED',
    requiresOwnCapabilityPackage: true,
  });
}

export function treasuryProductionState(): {
  readonly genesisAuthorizesSpending: false;
  readonly requiresConfiguredPolicy: true;
  readonly requiresGovernanceAuthorization: true;
} {
  return Object.freeze({
    genesisAuthorizesSpending: false,
    requiresConfiguredPolicy: true,
    requiresGovernanceAuthorization: true,
  });
}

export function feeMarketFindings(sample: FeeMarketSample): readonly string[] {
  const findings: string[] = [];
  if (sample.unexpectedOscillation) {
    findings.push('fee market oscillation exceeds configured rehearsal band');
  }
  if (sample.blockUtilizationBps > 9_500 && sample.resourceSaturationBps > 9_000) {
    findings.push('resource saturation accompanies utilization spike');
  }
  return Object.freeze(findings);
}
