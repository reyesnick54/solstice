/**
 * Domain-specific trust policy helpers — FX, markets, weather, resources.
 */

import type { ExternalObservation } from '../types.ts';
import type { ExternalDataTrustEngine, AssessTrustInput } from './engine.ts';
import type { CanonicalTrustResult, TrustObservationContext } from './types.ts';

type FxObservationData = {
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly rate: string;
  readonly asOf: string;
  readonly sourceProvider: string;
};

export type FxTrustInput = {
  readonly observations: readonly ExternalObservation<FxObservationData>[];
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly providerRisk?: Readonly<Record<string, { readonly state?: string; readonly quarantined?: boolean }>>;
};

export function buildFxTrustContexts(input: FxTrustInput): readonly TrustObservationContext<FxObservationData>[] {
  const semanticKey = `${input.baseCurrency}/${input.quoteCurrency}`;
  return Object.freeze(
    input.observations
      .filter(
        (o) =>
          o.data.baseCurrency === input.baseCurrency && o.data.quoteCurrency === input.quoteCurrency,
      )
      .map((observation) => {
        const risk = input.providerRisk?.[observation.providerId];
        const numericValue = parseFloat(observation.data.rate);
        return Object.freeze({
          observation,
          semanticKey,
          unit: input.quoteCurrency,
          numericValue: Number.isFinite(numericValue) ? numericValue : null,
          providerRiskState: mapRiskState(risk?.state),
          quarantined: risk?.quarantined ?? false,
        } satisfies TrustObservationContext<FxObservationData>);
      }),
  );
}

export function assessFxReferenceTrust(
  engine: ExternalDataTrustEngine,
  input: FxTrustInput,
): CanonicalTrustResult<{ readonly rate: string; readonly baseCurrency: string; readonly quoteCurrency: string; readonly asOf: string; readonly sourceProvider: string }> {
  const contexts = buildFxTrustContexts(input);
  return engine.assess<{
    readonly rate: string;
    readonly baseCurrency: string;
    readonly quoteCurrency: string;
    readonly asOf: string;
    readonly sourceProvider: string;
  }>({
    contexts,
    policyProfile: 'FX_REFERENCE',
    semanticKey: `${input.baseCurrency}/${input.quoteCurrency}`,
    unit: input.quoteCurrency,
    mapCanonicalValue: (eligible, numericValue) => {
      if (numericValue === null) return null;
      const selected = eligible.find((c) => c.numericValue === numericValue) ?? eligible[0];
      if (!selected) return null;
      return Object.freeze({
        rate: numericValue.toFixed(6),
        baseCurrency: input.baseCurrency,
        quoteCurrency: input.quoteCurrency,
        asOf: selected.observation.data.asOf,
        sourceProvider: selected.observation.providerId,
      });
    },
  });
}

type MarketObservationData = {
  readonly symbol: string;
  readonly priceMinor: bigint;
  readonly currency: string;
  readonly asOf: string;
  readonly sourceProvider: string;
  readonly exchange?: string | null;
};

export type MarketTrustInput = {
  readonly observations: readonly ExternalObservation<MarketObservationData>[];
  readonly assetId: string;
  readonly providerRisk?: Readonly<Record<string, { readonly state?: string; readonly quarantined?: boolean }>>;
};

export function buildMarketTrustContexts(input: MarketTrustInput): readonly TrustObservationContext<MarketObservationData>[] {
  return Object.freeze(
    input.observations
      .filter((o) => o.data.symbol === input.assetId || inferAssetId(o) === input.assetId)
      .map((observation) => {
        const risk = input.providerRisk?.[observation.providerId];
        const numericValue = Number(observation.data.priceMinor) / 100;
        return Object.freeze({
          observation,
          semanticKey: input.assetId,
          unit: observation.data.currency,
          numericValue: Number.isFinite(numericValue) ? numericValue : null,
          providerRiskState: mapRiskState(risk?.state),
          quarantined: risk?.quarantined ?? false,
        } satisfies TrustObservationContext<MarketObservationData>);
      }),
  );
}

function inferAssetId(observation: ExternalObservation<MarketObservationData>): string {
  return observation.data.symbol;
}

export function assessMarketReferenceTrust(
  engine: ExternalDataTrustEngine,
  input: MarketTrustInput,
): CanonicalTrustResult<{ readonly priceMinor: string; readonly currency: string; readonly symbol: string; readonly asOf: string; readonly sourceProvider: string }> {
  const contexts = buildMarketTrustContexts(input);
  return engine.assess({
    contexts,
    policyProfile: 'MARKET_REFERENCE',
    semanticKey: input.assetId,
    unit: contexts[0]?.unit ?? null,
    mapCanonicalValue: ((eligible, numericValue) => {
      if (numericValue === null) return null;
      const selected = eligible.find((c) => c.numericValue === numericValue) ?? eligible[0];
      if (!selected) return null;
      const priceMinor = BigInt(Math.round(numericValue * 100));
      return Object.freeze({
        priceMinor: priceMinor.toString(),
        currency: selected.observation.data.currency,
        symbol: selected.observation.data.symbol,
        asOf: selected.observation.data.asOf,
        sourceProvider: selected.observation.providerId,
      });
    }) as NonNullable<AssessTrustInput<MarketObservationData>['mapCanonicalValue']>,
  }) as unknown as CanonicalTrustResult<{
    readonly priceMinor: string;
    readonly currency: string;
    readonly symbol: string;
    readonly asOf: string;
    readonly sourceProvider: string;
  }>;
}

type ResourceObservationData = {
  readonly value: number;
  readonly unit: string;
  readonly geography?: string;
  readonly measurementKind?: string;
  readonly resourceType?: string;
};

export type ResourceEnergyTrustInput = {
  readonly observations: readonly ExternalObservation<ResourceObservationData>[];
  readonly semanticKey: string;
  readonly unit: string;
  readonly policyProfile: 'ENERGY' | 'RESOURCE';
  readonly providerRisk?: Readonly<Record<string, { readonly state?: string; readonly quarantined?: boolean }>>;
};

export function assessResourceEnergyTrust(
  engine: ExternalDataTrustEngine,
  input: ResourceEnergyTrustInput,
): CanonicalTrustResult<{ readonly value: number; readonly unit: string }> {
  const contexts: TrustObservationContext<ResourceObservationData>[] = input.observations.map((observation) => {
    const risk = input.providerRisk?.[observation.providerId];
    return Object.freeze({
      observation,
      semanticKey: input.semanticKey,
      unit: observation.data.unit,
      numericValue: observation.data.value,
      providerRiskState: mapRiskState(risk?.state),
      quarantined: risk?.quarantined ?? false,
    } satisfies TrustObservationContext<ResourceObservationData>);
  });
  return engine.assess<{ readonly value: number; readonly unit: string }>({
    contexts: Object.freeze(contexts),
    policyProfile: input.policyProfile,
    semanticKey: input.semanticKey,
    unit: input.unit,
    mapCanonicalValue: (eligible, numericValue) => {
      if (numericValue === null) return null;
      return Object.freeze({ value: numericValue, unit: input.unit });
    },
  });
}

function mapRiskState(
  state?: string,
): Exclude<TrustObservationContext['providerRiskState'], undefined> {
  switch (state) {
    case 'NORMAL':
      return 'NORMAL';
    case 'DEGRADED':
      return 'DEGRADED';
    case 'SUSPICIOUS':
      return 'SUSPICIOUS';
    case 'COMPROMISED_SUSPECTED':
      return 'COMPROMISED_SUSPECTED';
    case 'DISABLED':
      return 'DISABLED';
    default:
      return null;
  }
}
