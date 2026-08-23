/**
 * Read-only client, Lovable, and Agent surfaces for native-asset
 * economics. No privileged issuance or burn endpoints.
 */

import { snapshotOf, type AssetSupplyBook } from '../economics/supply.ts';
import { TICKER_STATUS_NOT_ASSIGNED, type NativeMonetaryAssetId } from '../economics/types.ts';
import { ProtocolNativeSupplyAuthority } from './economic-controls.ts';
import { economicPolicyDocument } from './economic-policy.ts';
import {
  PRODUCTIVE_CATEGORY_CATALOG,
  separateValuationFromMarketPrice,
  type ExchangeMarketPrice,
} from './issuance-pipelines.ts';
import { canonicalNativeAsset, nativeAssetRegistry, type CanonicalNativeAssetRecord } from './registry.ts';

export const NATIVE_ECONOMY_SCHEMA = 'sunrey.consumer.native-economy.v1' as const;

export type ClientSupplySemantics = {
  readonly totalSupply: string;
  readonly issuedSupply: string;
  readonly circulatingSupply: string;
  readonly burned: string;
  readonly locked: string;
  readonly semantics: {
    readonly total: 'genesisAllocated + issuedPostGenesis - burned';
    readonly circulating: 'live unlocked quantity';
    readonly issued: 'genesisAllocated + issuedPostGenesis';
  };
};

export type ClientNativeAssetResource = {
  readonly schema: typeof NATIVE_ECONOMY_SCHEMA;
  readonly asset: CanonicalNativeAssetRecord;
  readonly supply: ClientSupplySemantics;
  readonly protocolStatus: CanonicalNativeAssetRecord['status'];
  readonly network: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET';
  readonly policyVersion: string;
  readonly mainnetInactive: true;
  readonly privilegedIssuanceExposed: false;
};

function supplyOf(book: AssetSupplyBook): ClientSupplySemantics {
  const snap = snapshotOf(book);
  return Object.freeze({
    totalSupply: snap.expectedTotal.toString(),
    issuedSupply: (snap.genesisAllocated + snap.issuedPostGenesis).toString(),
    circulatingSupply: snap.circulating.toString(),
    burned: snap.burned.toString(),
    locked: snap.locked.toString(),
    semantics: Object.freeze({
      total: 'genesisAllocated + issuedPostGenesis - burned',
      circulating: 'live unlocked quantity',
      issued: 'genesisAllocated + issuedPostGenesis',
    }),
  });
}

export function clientNativeAssetResource(
  authority: ProtocolNativeSupplyAuthority,
  assetId: NativeMonetaryAssetId,
  network: ClientNativeAssetResource['network'] = 'DEVELOPMENT',
): ClientNativeAssetResource {
  const book = authority.book(assetId);
  const asset = canonicalNativeAsset(
    assetId,
    network === 'MAINNET' ? 'PRODUCTION_CANDIDATE' : network === 'TESTNET' ? 'TESTNET_ACTIVE' : 'DEVELOPMENT_ACTIVE',
  );
  return Object.freeze({
    schema: NATIVE_ECONOMY_SCHEMA,
    asset,
    supply: supplyOf(book),
    protocolStatus: asset.status,
    network,
    policyVersion: book.policyVersion,
    mainnetInactive: true,
    privilegedIssuanceExposed: false,
  });
}

export type LovableNativeEconomyContract = {
  readonly schema: typeof NATIVE_ECONOMY_SCHEMA;
  readonly tickerStatus: typeof TICKER_STATUS_NOT_ASSIGNED;
  readonly productionActive: false;
  readonly valuationIsNotMarketPrice: true;
  readonly sunrey: {
    readonly name: 'SunRey Coin';
    readonly protocolNative: true;
    readonly asset: ClientNativeAssetResource;
    readonly marketPrice: ExchangeMarketPrice;
    readonly hinMetrics: {
      readonly available: false;
      readonly reason: 'NO_APPROVED_PUBLIC_HIN_METRIC';
    };
    readonly economicModel: string;
  };
  readonly moonrey: {
    readonly name: 'MoonRey Coin';
    readonly protocolNative: true;
    readonly asset: ClientNativeAssetResource;
    readonly marketPrice: ExchangeMarketPrice;
    readonly productiveCategories: readonly {
      readonly id: (typeof PRODUCTIVE_CATEGORY_CATALOG)[number];
      readonly connected: false;
      readonly approvedCatalogOnly: true;
    }[];
    readonly approvedUnderlyingMetrics: readonly never[];
    readonly economicModel: string;
  };
};

export function lovableNativeEconomyContract(input: {
  readonly authority: ProtocolNativeSupplyAuthority;
  readonly network?: ClientNativeAssetResource['network'];
  readonly sunreyMarketPrice?: { readonly lastTradeMinorUnits: string; readonly quoteAsset: string };
  readonly moonreyMarketPrice?: { readonly lastTradeMinorUnits: string; readonly quoteAsset: string };
}): LovableNativeEconomyContract {
  const network = input.network ?? 'DEVELOPMENT';
  const sunreyValuation = separateValuationFromMarketPrice({
    valuation: {
      methodologyId: 'human-contribution-bridge',
      methodologyVersion: 'sunrey.human-contribution.monetary-bridge.v2',
      referenceValue: 'UNRESOLVED',
      denomination: 'NOT_MARKET_PRICE',
      isExchangeMarketPrice: false,
    },
    ...(input.sunreyMarketPrice ? { exchangePrice: input.sunreyMarketPrice } : {}),
  });
  const moonreyValuation = separateValuationFromMarketPrice({
    valuation: {
      methodologyId: 'productive-value-gpuv',
      methodologyVersion: 'moonrey.productive-value.v2',
      referenceValue: 'UNRESOLVED',
      denomination: 'GPUV_NOT_MOONREY',
      isExchangeMarketPrice: false,
    },
    ...(input.moonreyMarketPrice ? { exchangePrice: input.moonreyMarketPrice } : {}),
  });
  return Object.freeze({
    schema: NATIVE_ECONOMY_SCHEMA,
    tickerStatus: TICKER_STATUS_NOT_ASSIGNED,
    productionActive: false,
    valuationIsNotMarketPrice: true,
    sunrey: Object.freeze({
      name: 'SunRey Coin' as const,
      protocolNative: true as const,
      asset: clientNativeAssetResource(input.authority, 'SUNREY_COIN', network),
      marketPrice: sunreyValuation.marketPrice,
      hinMetrics: Object.freeze({
        available: false as const,
        reason: 'NO_APPROVED_PUBLIC_HIN_METRIC' as const,
      }),
      economicModel:
        'SunRey Coin is the protocol-native human-economic asset. Issuance requires a verified contribution, valuation that is not a market price, policy validation, and a MonetaryIssuanceAuthority. Mainnet economics remain NOT_AUTHORIZED.',
    }),
    moonrey: Object.freeze({
      name: 'MoonRey Coin' as const,
      protocolNative: true as const,
      asset: clientNativeAssetResource(input.authority, 'MOONREY_COIN', network),
      marketPrice: moonreyValuation.marketPrice,
      productiveCategories: Object.freeze(
        PRODUCTIVE_CATEGORY_CATALOG.map((id) =>
          Object.freeze({
            id,
            connected: false as const,
            approvedCatalogOnly: true as const,
          }),
        ),
      ),
      approvedUnderlyingMetrics: Object.freeze([]),
      economicModel:
        'MoonRey Coin is the protocol-native productive-economy asset. Issuance requires a verified productive contribution, provenance, methodology, oracle safety that cannot mint alone, and authorized protocol transition. GPUV is not MoonRey. Mainnet economics remain NOT_AUTHORIZED.',
    }),
  });
}

export const AGENT_NATIVE_ECONOMY_PERMISSIONS = Object.freeze({
  mayExplainSunReyCoin: true,
  mayExplainMoonReyCoin: true,
  mayRetrieveSupply: true,
  mayRetrieveMarketPrice: true,
  mayRetrieveApprovedMetrics: true,
  mayMint: false,
  mayBurn: false,
  mayModifyPolicy: false,
  mayChangeSupply: false,
  mayDeclareFuturePrice: false,
});

export type AgentNativeEconomyAction =
  | 'EXPLAIN'
  | 'READ_SUPPLY'
  | 'READ_MARKET_PRICE'
  | 'READ_APPROVED_METRICS'
  | 'MINT'
  | 'BURN'
  | 'MODIFY_POLICY'
  | 'CHANGE_SUPPLY'
  | 'DECLARE_FUTURE_PRICE';

export function authorizeAgentNativeEconomyAction(action: AgentNativeEconomyAction): {
  readonly ok: boolean;
  readonly code: 'AGENT_READ_ALLOWED' | 'AGENT_CANNOT_MUTATE_NATIVE_ASSETS' | 'AGENT_CANNOT_DECLARE_FUTURE_PRICE';
} {
  if (action === 'DECLARE_FUTURE_PRICE') {
    return { ok: false, code: 'AGENT_CANNOT_DECLARE_FUTURE_PRICE' };
  }
  if (
    action === 'MINT' ||
    action === 'BURN' ||
    action === 'MODIFY_POLICY' ||
    action === 'CHANGE_SUPPLY'
  ) {
    return { ok: false, code: 'AGENT_CANNOT_MUTATE_NATIVE_ASSETS' };
  }
  return { ok: true, code: 'AGENT_READ_ALLOWED' };
}

export function publicSupplyApi(authority: ProtocolNativeSupplyAuthority, network: ClientNativeAssetResource['network'] = 'DEVELOPMENT') {
  const policy = economicPolicyDocument({ network });
  return Object.freeze({
    schema: NATIVE_ECONOMY_SCHEMA,
    tickerStatus: TICKER_STATUS_NOT_ASSIGNED,
    network,
    policyVersion: policy.versionId,
    policyHash: policy.contentHash,
    mainnetEconomics: policy.mainnetEconomics,
    privilegedIssuanceEndpoints: Object.freeze([]),
    assets: Object.freeze(nativeAssetRegistry(policy.policyState).map((asset) =>
      clientNativeAssetResource(authority, asset.assetId, network),
    )),
  });
}
