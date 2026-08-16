import { evaluateIssuanceFormula, type FormulaResult } from './formula.ts';
import type { MoonReyIssuancePolicy } from './policy.ts';
import { PRODUCTIVE_SCHEMA_VERSION, type ProductiveCategory, type ProductiveRejectionCode } from './types.ts';
import type { VerifiedProductiveContribution } from './verification.ts';

export type MoonReyIssuanceAuthorization = {
  readonly schemaVersion: typeof PRODUCTIVE_SCHEMA_VERSION;
  readonly authorizationId: string;
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly recipient: string;
  readonly category: ProductiveCategory;
  readonly policyVersion: number;
  readonly formula: FormulaResult;
  readonly moonreyQuantity: bigint;
  readonly epoch: number;
  readonly finalized: false;
};

export type MoonReyIssuanceReceipt = {
  readonly schemaVersion: typeof PRODUCTIVE_SCHEMA_VERSION;
  readonly issuanceId: string;
  readonly recipient: string;
  readonly productiveContributionId: string;
  readonly fingerprint: string;
  readonly category: ProductiveCategory;
  readonly inputQuantity: bigint;
  readonly inputUnit: string;
  readonly policyVersion: number;
  readonly formulaInputs: FormulaResult;
  readonly rounding: FormulaResult['roundingMode'];
  readonly moonreyQuantity: bigint;
  readonly oracleFacts: readonly string[];
  readonly blockHeight: number;
  readonly blockId: string;
};

export type EpochIssuance = {
  readonly epoch: number;
  readonly total: bigint;
  readonly byCategory: Readonly<Record<string, bigint>>;
  readonly byObject: Readonly<Record<string, bigint>>;
  readonly byController: Readonly<Record<string, bigint>>;
};

export type IssuanceEvaluation =
  | { readonly ok: true; readonly authorization: MoonReyIssuanceAuthorization }
  | { readonly ok: false; readonly code: ProductiveRejectionCode };

export function evaluateIssuance(
  contribution: VerifiedProductiveContribution,
  policy: MoonReyIssuancePolicy,
  epoch: EpochIssuance,
  issuedFingerprints: ReadonlySet<string>,
): IssuanceEvaluation {
  if (issuedFingerprints.has(contribution.fingerprint)) {
    return { ok: false, code: 'DUPLICATE_ISSUANCE' };
  }
  if (!policy.eligibleCategories.includes(contribution.category)) {
    return { ok: false, code: 'POLICY_INELIGIBLE_CATEGORY' };
  }
  if (contribution.claimType === 'CAPACITY' && !policy.countCapacityAsProduction) {
    return { ok: false, code: 'POLICY_INELIGIBLE_CLAIM_TYPE' };
  }
  if (contribution.claimType === 'DELIVERY' && !policy.countDeliveryIndependentOfOutput) {
    return { ok: false, code: 'POLICY_INELIGIBLE_CLAIM_TYPE' };
  }
  if (contribution.claimType === 'RESERVE') {
    return { ok: false, code: 'POLICY_INELIGIBLE_CLAIM_TYPE' };
  }
  const formula = evaluateIssuanceFormula({
    eligibleQuantity: contribution.normalizedQuantity,
    categoryWeight: policy.categoryWeight[contribution.category],
    claimTypeWeight: policy.claimTypeWeight[contribution.claimType],
    qualityFactor: mulQuality(contribution.qualityFactor, policy.qualityMultiplier),
    roundingMode: policy.roundingMode,
    maximumIssuance: policy.maximumIssuancePerContribution,
  });
  if (formula.moonreyQuantity <= 0n) {
    return { ok: false, code: 'POLICY_INELIGIBLE_CLAIM_TYPE' };
  }
  const categoryUsed = epoch.byCategory[contribution.category] ?? 0n;
  if (categoryUsed + formula.moonreyQuantity > policy.maximumIssuancePerCategoryPerEpoch) {
    return { ok: false, code: 'EPOCH_CATEGORY_CAP' };
  }
  if (epoch.total + formula.moonreyQuantity > policy.maximumTotalIssuancePerEpoch) {
    return { ok: false, code: 'EPOCH_GLOBAL_CAP' };
  }
  const objectUsed = epoch.byObject[contribution.objectId] ?? 0n;
  if (objectUsed + formula.moonreyQuantity > policy.maximumIssuancePerObjectPerEpoch) {
    return { ok: false, code: 'OBJECT_ISSUANCE_CAP' };
  }
  const controllerUsed = epoch.byController[contribution.controller] ?? 0n;
  if (controllerUsed + formula.moonreyQuantity > policy.maximumIssuancePerControllerPerEpoch) {
    return { ok: false, code: 'CONTROLLER_ISSUANCE_CAP' };
  }
  return {
    ok: true,
    authorization: Object.freeze({
      schemaVersion: PRODUCTIVE_SCHEMA_VERSION,
      authorizationId: `mia.${contribution.fingerprint.slice(0, 32)}`,
      contributionId: contribution.contributionId,
      fingerprint: contribution.fingerprint,
      recipient: contribution.controller,
      category: contribution.category,
      policyVersion: policy.policyVersion,
      formula,
      moonreyQuantity: formula.moonreyQuantity,
      epoch: contribution.measurementPeriod.epoch,
      finalized: false,
    }),
  };
}

export function finalizeIssuance(
  authorization: MoonReyIssuanceAuthorization,
  contribution: VerifiedProductiveContribution,
  blockHeight: number,
  blockId: string,
): MoonReyIssuanceReceipt {
  return Object.freeze({
    schemaVersion: PRODUCTIVE_SCHEMA_VERSION,
    issuanceId: `mir.${authorization.authorizationId.slice(4)}`,
    recipient: authorization.recipient,
    productiveContributionId: contribution.contributionId,
    fingerprint: contribution.fingerprint,
    category: authorization.category,
    inputQuantity: contribution.quantity,
    inputUnit: contribution.unit,
    policyVersion: authorization.policyVersion,
    formulaInputs: authorization.formula,
    rounding: authorization.formula.roundingMode,
    moonreyQuantity: authorization.moonreyQuantity,
    oracleFacts: contribution.oracleFactIds,
    blockHeight,
    blockId,
  });
}

export function emptyEpoch(epoch: number): EpochIssuance {
  return Object.freeze({
    epoch,
    total: 0n,
    byCategory: Object.freeze({}),
    byObject: Object.freeze({}),
    byController: Object.freeze({}),
  });
}

export function recordEpochIssuance(
  epoch: EpochIssuance,
  contribution: VerifiedProductiveContribution,
  quantity: bigint,
): EpochIssuance {
  return Object.freeze({
    epoch: epoch.epoch,
    total: epoch.total + quantity,
    byCategory: Object.freeze({
      ...epoch.byCategory,
      [contribution.category]: (epoch.byCategory[contribution.category] ?? 0n) + quantity,
    }),
    byObject: Object.freeze({
      ...epoch.byObject,
      [contribution.objectId]: (epoch.byObject[contribution.objectId] ?? 0n) + quantity,
    }),
    byController: Object.freeze({
      ...epoch.byController,
      [contribution.controller]: (epoch.byController[contribution.controller] ?? 0n) + quantity,
    }),
  });
}

function mulQuality(medianQuality: bigint, policyMultiplier: bigint): bigint {
  return (medianQuality * policyMultiplier) / 1_000_000n;
}
