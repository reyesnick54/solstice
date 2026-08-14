import type { DataPurpose, PersonalDataCategory } from '@solstice/kernel';
import type { IdentityExposureLevel } from '../consent/types.ts';
import { DATA_VALUATION_MODEL_ID, type RegisteredModel } from './registry.ts';

export type ValuationInput = {
  readonly category: PersonalDataCategory;
  readonly purpose: DataPurpose;
  readonly identityExposureLevel: IdentityExposureLevel;
  readonly durationDays: bigint;
  readonly resalePermission: boolean;
  readonly aiTrainingPermission: boolean;
};

export type IndicativeCompensation = {
  readonly modelId: string;
  readonly indicativeMinorUnits: bigint;
  readonly currency: 'USD';
  readonly presentation: 'INDICATIVE_COMPENSATION_NOT_A_PRICE';
  readonly notAGuaranteedPrice: true;
  readonly disclaimer: string;
};

const CATEGORY_BASE: Readonly<Record<PersonalDataCategory, bigint>> = {
  IDENTITY: 400n,
  FINANCIAL: 800n,
  HEALTH: 1200n,
  WELLNESS: 600n,
  CONSUMPTION: 300n,
  ENTERTAINMENT: 200n,
  WORK: 500n,
  LIFESTYLE: 250n,
  GOALS: 350n,
  PSYCHOLOGICAL: 1300n,
  PREFERENCES: 150n,
  PURCHASE_INTENT: 450n,
};

/**
 * Indicative compensation only. Never a guaranteed price, bid, or market quote.
 * LIVE_DATA_MARKET_ENABLED stays false. Amounts are integer minor units.
 */
export function indicativeCompensation(
  model: RegisteredModel,
  input: ValuationInput,
): IndicativeCompensation {
  if (model.modelId !== DATA_VALUATION_MODEL_ID) {
    throw new Error('valuation model is not registered');
  }
  let units = CATEGORY_BASE[input.category];
  if (input.identityExposureLevel === 'identified') {
    units += 200n;
  } else if (input.identityExposureLevel === 'pseudonymous') {
    units += 50n;
  }
  if (input.resalePermission) {
    units += 100n;
  }
  if (input.aiTrainingPermission) {
    units += 75n;
  }
  if (input.durationDays > 365n) {
    units += 25n;
  }
  return Object.freeze({
    modelId: model.modelId,
    indicativeMinorUnits: units,
    currency: 'USD',
    presentation: 'INDICATIVE_COMPENSATION_NOT_A_PRICE',
    notAGuaranteedPrice: true,
    disclaimer:
      'Indicative compensation for the simulation only. Not a guaranteed price, offer, or market quote.',
  });
}
