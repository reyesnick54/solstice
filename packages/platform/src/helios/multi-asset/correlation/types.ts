/**
 * HELIOS Multi-Asset M17 — correlation context inputs consumed by downstream sizing.
 * Reference analytics only. Does not grant Execution Authority.
 */

export const HELIOS_MULTI_ASSET_M17_CORRELATION_CONTEXT_SCHEMA =
  'sunrey.helios.multi-asset.m17.correlation-context.v1' as const;

export type CorrelationPairExposure = {
  readonly instrumentId: string;
  readonly correlationBps: number;
  readonly sharedFactorRefs: readonly string[];
};

export type CorrelationContextInput = {
  readonly schema: typeof HELIOS_MULTI_ASSET_M17_CORRELATION_CONTEXT_SCHEMA;
  readonly portfolioId: string;
  readonly targetInstrumentId: string;
  readonly averageCorrelationBps: number;
  readonly maxCorrelationBps: number;
  readonly correlatedExposureMinor: string;
  readonly pairExposures: readonly CorrelationPairExposure[];
  readonly stateVersion: string;
  readonly computedAt: string;
};

export function createCorrelationContextInput(
  input: Omit<CorrelationContextInput, 'schema'>,
): CorrelationContextInput {
  return Object.freeze({
    schema: HELIOS_MULTI_ASSET_M17_CORRELATION_CONTEXT_SCHEMA,
    ...input,
  });
}
