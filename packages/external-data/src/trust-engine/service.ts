/**
 * External Data Trust Engine orchestration — sits above ExternalDataPlane.
 *
 * Composes provider-sdk trust engine with plane observations and provider risk.
 */

import {
  assessFxReferenceTrust,
  assessMarketReferenceTrust,
  assessResourceEnergyTrust,
  augmentEvidenceWithTrust,
  buildFxTrustContexts,
  buildMarketTrustContexts,
  createExternalDataTrustEngine,
  toWorldQualitySnapshot,
  type CanonicalTrustResult,
  type ExternalDataTrustEngine,
  type TrustObservationContext,
  type TrustResultRecord,
  type TrustAugmentedEvidenceRef,
  type WorldQualitySnapshot,
} from '../../../provider-sdk/src/trust/index.ts';
import type { ExternalObservation } from '../../../provider-sdk/src/types.ts';
import type { ExternalDataPlane } from '../plane.ts';
import type { FxReferenceRate, MarketQuote } from '../models.ts';

export type ExternalDataTrustPlaneOptions = {
  readonly nowUtc?: () => string;
};

export class ExternalDataTrustPlane {
  readonly #engine: ExternalDataTrustEngine;
  readonly #auditLog: TrustResultRecord[] = [];

  constructor(options: ExternalDataTrustPlaneOptions = {}) {
    this.#engine = createExternalDataTrustEngine(
      options.nowUtc !== undefined ? { nowUtc: options.nowUtc } : {},
    );
  }

  engine(): ExternalDataTrustEngine {
    return this.#engine;
  }

  auditLog(): readonly TrustResultRecord[] {
    return Object.freeze([...this.#auditLog]);
  }

  assessFxFromPlane(plane: ExternalDataPlane, base = 'USD', quote?: string): CanonicalTrustResult<{
    readonly rate: string;
    readonly baseCurrency: string;
    readonly quoteCurrency: string;
    readonly asOf: string;
    readonly sourceProvider: string;
  }> | null {
    const rates = plane.fx.getRates(base);
    if (rates.observations.length === 0) {
      return null;
    }
    const observations = quote
      ? rates.observations.filter((o) => o.data.quoteCurrency === quote)
      : rates.observations;
    if (observations.length === 0 || !quote) {
      if (!quote && observations.length > 0) {
        const first = observations[0]!;
        return this.assessFxPair(plane, base, first.data.quoteCurrency, observations);
      }
      return null;
    }
    return this.assessFxPair(plane, base, quote, observations);
  }

  assessFxPair(
    plane: ExternalDataPlane,
    base: string,
    quote: string,
    observations?: readonly ExternalObservation<FxReferenceRate>[],
  ): CanonicalTrustResult<{
    readonly rate: string;
    readonly baseCurrency: string;
    readonly quoteCurrency: string;
    readonly asOf: string;
    readonly sourceProvider: string;
  }> {
    const obs = observations ?? plane.fx.getRates(base).observations.filter((o) => o.data.quoteCurrency === quote);
    const providerRisk = this.#providerRiskMap(plane);
    const result = assessFxReferenceTrust(this.#engine, {
      observations: obs,
      baseCurrency: base,
      quoteCurrency: quote,
      providerRisk,
    });
    this.#record(result);
    return result;
  }

  assessMarketFromPlane(
    plane: ExternalDataPlane,
    assetId: string,
  ): CanonicalTrustResult<{
    readonly priceMinor: string;
    readonly currency: string;
    readonly symbol: string;
    readonly asOf: string;
    readonly sourceProvider: string;
  }> {
    const quotes = plane.markets.getQuotes([assetId]);
    const providerRisk = this.#providerRiskMap(plane);
    const result = assessMarketReferenceTrust(this.#engine, {
      observations: quotes.observations,
      assetId,
      providerRisk,
    });
    this.#record(result);
    return result;
  }

  assessResourceEnergy(
    observations: readonly ExternalObservation<{ readonly value: number; readonly unit: string }>[],
    semanticKey: string,
    unit: string,
    policyProfile: 'ENERGY' | 'RESOURCE',
    plane?: ExternalDataPlane,
  ): CanonicalTrustResult<{ readonly value: number; readonly unit: string }> {
    const providerRisk = plane ? this.#providerRiskMap(plane) : {};
    const result = assessResourceEnergyTrust(this.#engine, {
      observations,
      semanticKey,
      unit,
      policyProfile,
      providerRisk,
    });
    this.#record(result);
    return result;
  }

  assessObservations<T>(
    contexts: readonly TrustObservationContext<T>[],
    policyProfile: import('../../../provider-sdk/src/trust/types.ts').TrustPolicyProfile,
    semanticKey: string,
    unit?: string | null,
  ): CanonicalTrustResult<T> {
    const result = this.#engine.assess({
      contexts,
      policyProfile,
      semanticKey,
      ...(unit !== undefined && unit !== null ? { unit } : {}),
    });
    this.#record(result);
    return result;
  }

  agentEvidenceWithTrust(plane: ExternalDataPlane): {
    readonly refs: readonly TrustAugmentedEvidenceRef[];
    readonly grantsExecutionAuthority: false;
    readonly trustPolicyVersions: readonly string[];
  } {
    const bundle = plane.agentEvidenceBundle();
    const fxTrust = this.assessFxFromPlane(plane, 'USD', 'EUR');
    const marketTrust = this.assessMarketFromPlane(plane, 'AAPL');
    const trustByCapability = new Map<string, CanonicalTrustResult<unknown>>();
    if (fxTrust) trustByCapability.set('fx_rates', fxTrust);
    if (marketTrust) trustByCapability.set('market_prices', marketTrust);

    const refs = bundle.refs.map((ref) => {
      const trust =
        ref.capability === 'fx_rates'
          ? fxTrust
          : ref.capability === 'market_prices' || ref.capability === 'spot_price'
            ? marketTrust
            : null;
      return augmentEvidenceWithTrust(ref, trust);
    });

    const versions = [...new Set([fxTrust?.trustPolicyVersion, marketTrust?.trustPolicyVersion].filter(Boolean))] as string[];

    return Object.freeze({
      refs: Object.freeze(refs),
      grantsExecutionAuthority: false,
      trustPolicyVersions: Object.freeze(versions),
    });
  }

  worldQualityForFx(plane: ExternalDataPlane, base: string, quote: string): WorldQualitySnapshot {
    const trust = this.assessFxPair(plane, base, quote);
    return toWorldQualitySnapshot(trust);
  }

  #providerRiskMap(plane: ExternalDataPlane): Record<string, { readonly state?: string; readonly quarantined?: boolean }> {
    const map: Record<string, { readonly state?: string; readonly quarantined?: boolean }> = {};
    for (const health of plane.health()) {
      const score = plane.providerRisk.monitor.assess({
        providerId: health.providerId,
        adapterState: {
          enabled: health.enabled,
          down: health.health === 'unhealthy',
          malformed: false,
          rateLimited: health.health === 'degraded',
          circuitState: health.circuitState as 'OPEN' | 'CLOSED' | 'HALF_OPEN',
          lastSuccess: health.lastSuccess,
          lastError: health.lastError,
        },
      });
      map[health.providerId] = Object.freeze({
        state: score.state,
        quarantined: score.quarantined,
      });
    }
    return map;
  }

  #record(result: CanonicalTrustResult<unknown>): void {
    this.#auditLog.push(this.#engine.toAuditRecord(result));
  }
}

export function createExternalDataTrustPlane(options?: ExternalDataTrustPlaneOptions): ExternalDataTrustPlane {
  return new ExternalDataTrustPlane(options);
}

export {
  assessFxReferenceTrust,
  assessMarketReferenceTrust,
  assessResourceEnergyTrust,
  buildFxTrustContexts,
  buildMarketTrustContexts,
  createExternalDataTrustEngine,
  toWorldQualitySnapshot,
  augmentEvidenceWithTrust,
};
