import { ATTRIBUTION_SHARE_SCALE } from '../value-function/types.ts';
import { WEIGHT_SCALE } from '../../types.ts';
import type { VerifiedProductiveContribution } from '../../verification.ts';
import { computeProductiveValueDigest } from './digest.ts';
import type { ProductiveValueResult } from './types.ts';
import type { ProductiveAttributionDecision, ProductiveEconomicEventIdentity } from '../value-function/types.ts';

export function fixtureContribution(
  overrides: Partial<VerifiedProductiveContribution> = {},
): VerifiedProductiveContribution {
  return Object.freeze({
    schemaVersion: 1,
    contributionId: 'c.energy.v2.1',
    claimId: 'claim.energy.v2.1',
    objectId: 'obj.solar.v2.1',
    claimType: 'OUTPUT',
    category: 'ENERGY',
    quantity: 1_200n,
    unit: 'kWh',
    normalizedQuantity: 1_200_000n,
    baseUnitId: 'Wh',
    measurementPeriod: {
      validFromUnixSeconds: 1_799_000_000n,
      validUntilUnixSeconds: 1_800_000_000n,
      epoch: 1,
    },
    geography: { geographyId: 'grid.west', jurisdiction: 'SIMULATION' },
    oracleFactIds: ['fact.v2.1', 'fact.v2.2', 'fact.v2.3'],
    rightsReferences: ['right.v2.1'],
    controller: 'ctl.solar.v2.1',
    fingerprint: 'fp.energy.v2.1',
    fingerprintVersion: 'PRODUCTIVE_FINGERPRINT_V1',
    upstreamContributionIds: [],
    downstreamContributionIds: [],
    status: 'ELIGIBLE',
    qualityFactor: WEIGHT_SCALE,
    normalizationReceiptId: 'norm.energy.v2.1',
    ...overrides,
  });
}

export function fixtureEvent(
  contribution: VerifiedProductiveContribution,
  overrides: Partial<ProductiveEconomicEventIdentity & { readonly eventFingerprint: string }> = {},
): ProductiveEconomicEventIdentity & { readonly eventFingerprint: string } {
  return Object.freeze({
    eventId: 'event.energy.v2.1',
    identityVersion: '1',
    category: contribution.category,
    objectId: contribution.objectId,
    measurementPeriod: contribution.measurementPeriod,
    eventFingerprint: 'efp.energy.v2.1',
    ...overrides,
  });
}

export function fixtureAttribution(
  contribution: VerifiedProductiveContribution,
  eventId: string,
  shareNumerator = 400_000n,
): ProductiveAttributionDecision {
  return Object.freeze({
    decisionId: 'attr.v2.1',
    policyId: 'moonrey.attribution.simulation.v1',
    policyVersion: '1',
    eventId,
    claimId: contribution.claimId,
    share: { numerator: shareNumerator, denominator: ATTRIBUTION_SHARE_SCALE },
    availableShare: { numerator: shareNumerator, denominator: ATTRIBUTION_SHARE_SCALE },
    authoritative: true,
    reconciled: true,
  });
}

export function fixtureProductiveValueResult(input: {
  readonly contribution: VerifiedProductiveContribution;
  readonly event: ProductiveEconomicEventIdentity & { readonly eventFingerprint: string };
  readonly attribution: ProductiveAttributionDecision;
  readonly productiveValueQuantity?: bigint;
  readonly productiveValueId?: string;
  readonly valueFunctionPolicyVersion?: number;
  readonly state?: ProductiveValueResult['state'];
  readonly environment?: ProductiveValueResult['environment'];
}): ProductiveValueResult {
  const eventBasisQuantity = 25_000n;
  const productiveValueQuantity = input.productiveValueQuantity ?? 10_000n;
  const draft = {
    productiveValueId: input.productiveValueId ?? 'pvr.energy.v2.1',
    contributionId: input.contribution.contributionId,
    contributionFingerprint: input.contribution.fingerprint,
    eventId: input.event.eventId,
    eventFingerprint: input.event.eventFingerprint,
    attributionDecisionId: input.attribution.decisionId,
    normalizationReceiptId: input.contribution.normalizationReceiptId ?? 'norm.energy.v2.1',
    valueFunctionPolicyId: 'moonrey.productive-value-function.simulation.v1',
    valueFunctionPolicyVersion: input.valueFunctionPolicyVersion ?? 1,
    productiveValueQuantity,
    productiveValueUnit: 'GPUV' as const,
    productiveValueDigest: '',
    state: input.state ?? ('VALUED_SIMULATION' as const),
    canMint: false as const,
    productionActivated: false as const,
    environment: input.environment ?? ('SIMULATION' as const),
    parameterClass: 'ENGINEERING_SIMULATION_PARAMETERS' as const,
    valueFunctionQuantityCap: 25_000n,
    attributionShare: input.attribution.share,
    eventBasisQuantity,
    jurisdiction: input.contribution.geography.jurisdiction,
    objectId: input.contribution.objectId,
    controller: input.contribution.controller,
    category: input.contribution.category,
    epoch: input.contribution.measurementPeriod.epoch,
    oracleFactIds: input.contribution.oracleFactIds,
  };
  return Object.freeze({
    ...draft,
    productiveValueDigest: computeProductiveValueDigest(draft),
  });
}
