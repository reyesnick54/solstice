/**
 * HELIOS Multi-Asset M18 — factor exposure context inputs consumed by downstream sizing.
 * Reference analytics only. Does not grant Execution Authority.
 */

export const HELIOS_MULTI_ASSET_M18_FACTOR_EXPOSURE_CONTEXT_SCHEMA =
  'sunrey.helios.multi-asset.m18.factor-exposure-context.v1' as const;

export type FactorExposureEntry = {
  readonly factorId: string;
  readonly exposureBps: number;
  readonly limitBps: number;
};

export type FactorExposureContextInput = {
  readonly schema: typeof HELIOS_MULTI_ASSET_M18_FACTOR_EXPOSURE_CONTEXT_SCHEMA;
  readonly portfolioId: string;
  readonly targetInstrumentId: string;
  readonly factorExposures: readonly FactorExposureEntry[];
  readonly projectedCrowdingBps: number;
  readonly stateVersion: string;
  readonly computedAt: string;
};

export function createFactorExposureContextInput(
  input: Omit<FactorExposureContextInput, 'schema'>,
): FactorExposureContextInput {
  return Object.freeze({
    schema: HELIOS_MULTI_ASSET_M18_FACTOR_EXPOSURE_CONTEXT_SCHEMA,
    ...input,
  });
}
