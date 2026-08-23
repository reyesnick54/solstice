/**
 * MoonRey issuance interface.
 *
 * verified observations → Productive Value Engine → approved methodology
 * → policy/governance → issuance proposal → authorized native-asset
 * transition.
 *
 * There is no oracle → mint path.
 */

import {
  evaluateOracleSafety,
  runMoonReyIssuancePipeline,
  separateValuationFromMarketPrice,
  type ExchangeMarketPrice,
  type OracleObservationQuality,
} from '../../native-assets/issuance-pipelines.ts';
import { ProtocolNativeSupplyAuthority } from '../../native-assets/economic-controls.ts';
import { verificationEligibleForValuation } from './verification.ts';
import type { EconomicObservation, ProductiveValueMethodology } from './types.ts';

export const ORACLE_CANNOT_MINT = true as const;
export const PRODUCTIVE_VALUE_IS_NOT_SUPPLY_POLICY = true as const;
export const SUPPLY_POLICY_IS_NOT_EXCHANGE_PRICE = true as const;

export type EconomySeparation = {
  readonly productiveEconomicValue: {
    readonly unit: 'GPUV';
    readonly input: string;
    readonly isMoonReyQuantity: false;
  };
  readonly moonreySupplyPolicy: {
    readonly authorized: false;
    readonly productionActive: false;
  };
  readonly moonreyExchangePrice: ExchangeMarketPrice;
  readonly interchangeable: false;
};

export function separateEconomyPlanes(input: {
  readonly gpuvInput: bigint;
  readonly exchangePrice?: { readonly lastTradeMinorUnits: string; readonly quoteAsset: string };
}): EconomySeparation {
  const split = separateValuationFromMarketPrice({
    valuation: {
      methodologyId: 'productive-value-gpuv',
      methodologyVersion: 'moonrey.productive-value.v2',
      referenceValue: input.gpuvInput.toString(),
      denomination: 'GPUV_NOT_MOONREY',
      isExchangeMarketPrice: false,
    },
    ...(input.exchangePrice ? { exchangePrice: input.exchangePrice } : {}),
  });
  return Object.freeze({
    productiveEconomicValue: Object.freeze({
      unit: 'GPUV' as const,
      input: input.gpuvInput.toString(),
      isMoonReyQuantity: false,
    }),
    moonreySupplyPolicy: Object.freeze({
      authorized: false,
      productionActive: false,
    }),
    moonreyExchangePrice: split.marketPrice,
    interchangeable: false,
  });
}

export function observationsToOracleQuality(
  observations: readonly EconomicObservation[],
): readonly OracleObservationQuality[] {
  return observations.map((row) =>
    Object.freeze({
      observationId: row.observationId,
      quality:
        row.verification === 'INVALID'
          ? 'INVALID'
          : row.verification === 'STALE'
            ? 'STALE'
            : row.verification === 'DISPUTED'
              ? 'DISPUTED'
              : 'VALID',
      confidenceBps: Number(row.confidenceBps),
      provenance: row.provenance.evidenceRef,
      freshnessUtc: row.freshness.expiresAtUtc,
      stale: row.freshness.state === 'STALE' || row.freshness.state === 'EXPIRED',
      disputed: row.verification === 'DISPUTED',
    }),
  );
}

export function proposeMoonReyIssuanceFromObservations(input: {
  readonly observations: readonly EconomicObservation[];
  readonly methodology: ProductiveValueMethodology;
  readonly authority?: ProtocolNativeSupplyAuthority;
  readonly recipient?: string;
}): {
  readonly ok: false;
  readonly code: string;
  readonly minted: false;
} {
  if (input.methodology.hardcodedIssuanceRatio || input.methodology.productionAuthorized) {
    return { ok: false, code: 'METHODOLOGY_NOT_AUTHORIZED', minted: false };
  }
  const usable = input.observations.filter(
    (row) => verificationEligibleForValuation(row.verification) && row.freshness.usableForTimeSensitiveValuation,
  );
  if (usable.length === 0) {
    return { ok: false, code: 'NO_VERIFIED_FRESH_OBSERVATION', minted: false };
  }
  const safety = evaluateOracleSafety({ observations: observationsToOracleQuality(usable) });
  if (!safety.ok) {
    return { ok: false, code: safety.code, minted: false };
  }
  const authority = input.authority ?? new ProtocolNativeSupplyAuthority();
  const pipeline = runMoonReyIssuancePipeline(authority, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: input.recipient ?? 'acct_sim',
    quantity: 1n,
    replayIdentifier: `pedp.${usable[0]!.observationId}`,
    contributionId: '',
    fingerprint: '',
    authorizationId: '',
    category: 'ENERGY',
    oracleOnly: true,
    observations: observationsToOracleQuality(usable),
  });
  return { ok: false, code: pipeline.ok ? 'ORACLE_CANNOT_MINT' : pipeline.code, minted: false };
}
