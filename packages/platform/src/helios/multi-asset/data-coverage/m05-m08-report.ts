/**
 * M05–M08 HELIOS Multi-Asset Data Coverage Report generator.
 */

export type AssetCoverageStatus = 'qualified' | 'partial' | 'missing' | 'simulation_only';

export type ProviderCoverage = {
  readonly providerId: string;
  readonly status: 'qualified' | 'adapter_ready' | 'missing' | 'blocked';
  readonly credentialEnv: string | null;
  readonly capabilities: readonly string[];
};

export type AssetClassCoverage = {
  readonly milestone: 'M05' | 'M06' | 'M07' | 'M08';
  readonly assetClass: string;
  readonly status: AssetCoverageStatus;
  readonly canonicalOwner: string;
  readonly identities: readonly string[];
  readonly supportedIntervals: readonly string[];
  readonly qualifiedProviders: readonly ProviderCoverage[];
  readonly missingProviders: readonly string[];
  readonly credentialDependencies: readonly string[];
  readonly externalDependencies: readonly string[];
  readonly unavailableCapabilities: readonly string[];
};

export type M05M08CoverageReport = {
  readonly reportId: 'helios-multi-asset-m05-m08-coverage';
  readonly generatedAt: string;
  readonly qualificationMarkers: Readonly<Record<string, string | null>>;
  readonly assetClasses: readonly AssetClassCoverage[];
  readonly summary: {
    readonly qualifiedCount: number;
    readonly partialCount: number;
    readonly missingCount: number;
  };
};

export function generateM05M08CoverageReport(nowUtc: string): M05M08CoverageReport {
  const assetClasses: AssetClassCoverage[] = [
    Object.freeze({
      milestone: 'M05',
      assetClass: 'equities/index',
      status: 'partial',
      canonicalOwner: 'packages/sunrey-exchange/src/capital-market/',
      identities: Object.freeze([
        'SECURITY:US:AAPL:XNAS',
        'SECURITY:US:SPY:ARCX',
      ]),
      supportedIntervals: Object.freeze(['quote', 'session_status']),
      qualifiedProviders: Object.freeze([
        Object.freeze({
          providerId: 'finnhub',
          status: 'adapter_ready',
          credentialEnv: 'FINNHUB_API_KEY',
          capabilities: Object.freeze(['quote', 'ticker']),
        }),
      ]),
      missingProviders: Object.freeze(['polygon', 'iex', 'alpha_vantage']),
      credentialDependencies: Object.freeze(['FINNHUB_API_KEY']),
      externalDependencies: Object.freeze(['finnhub.io API']),
      unavailableCapabilities: Object.freeze(['1h', '4h', '1d OHLCV via HELIOS capital-market route']),
    }),
    Object.freeze({
      milestone: 'M06',
      assetClass: 'crypto',
      status: 'simulation_only',
      canonicalOwner: 'packages/sunrey-exchange/src/crypto-market/',
      identities: Object.freeze([
        'CRYPTO:BTC:bitcoin:native:USD',
        'CRYPTO:ETH:ethereum:native:USD',
      ]),
      supportedIntervals: Object.freeze(['1h', '4h', '1d']),
      qualifiedProviders: Object.freeze([
        Object.freeze({
          providerId: 'coingecko',
          status: 'adapter_ready',
          credentialEnv: null,
          capabilities: Object.freeze(['crypto_prices', 'crypto_market_history']),
        }),
        Object.freeze({
          providerId: 'coincap',
          status: 'adapter_ready',
          credentialEnv: null,
          capabilities: Object.freeze(['crypto_prices']),
        }),
      ]),
      missingProviders: Object.freeze(['coinmarketcap']),
      credentialDependencies: Object.freeze(['CRYPTOCOMPARE_API_KEY (optional)']),
      externalDependencies: Object.freeze(['CoinGecko', 'CoinCap', 'CoinPaprika APIs (simulation)']),
      unavailableCapabilities: Object.freeze(['HELIOS multi-asset crypto route', 'live execution']),
    }),
    Object.freeze({
      milestone: 'M07',
      assetClass: 'gold',
      status: 'partial',
      canonicalOwner: 'packages/sunrey-exchange/src/market-reference/',
      identities: Object.freeze(['COMMODITY:gold:USD:troy_oz']),
      supportedIntervals: Object.freeze(['quote', '1d']),
      qualifiedProviders: Object.freeze([
        Object.freeze({
          providerId: 'sunrey-market-reference-simulation',
          status: 'qualified',
          credentialEnv: null,
          capabilities: Object.freeze(['commodity_prices', 'market_history']),
        }),
      ]),
      missingProviders: Object.freeze(['lbma', 'comex_live', 'kitco']),
      credentialDependencies: Object.freeze([]),
      externalDependencies: Object.freeze(['simulation registry only — no live gold feed']),
      unavailableCapabilities: Object.freeze([
        'HELIOS multi-asset gold route',
        'futures family (GC)',
        '4h trend bars via HELIOS',
      ]),
    }),
    Object.freeze({
      milestone: 'M08',
      assetClass: 'oil/WTI',
      status: 'qualified',
      canonicalOwner: 'packages/platform/src/helios/multi-asset/energy/wti/',
      identities: Object.freeze([
        'SECURITY:US:USO:ARCX',
        'COMMODITY:wti:USD:barrel',
        'FUTURES_FAMILY:NYMEX:CL:WTI',
        'FUTURES:NYMEX:CL:WTI:CONTINUOUS',
        'FUTURES:NYMEX:CL:WTI:2026-06',
      ]),
      supportedIntervals: Object.freeze(['quote', '1h', '4h', '1d', 'volume', 'session_state']),
      qualifiedProviders: Object.freeze([
        Object.freeze({
          providerId: 'helios-wti-sandbox',
          status: 'qualified',
          credentialEnv: 'HELIOS_WTI_SANDBOX_ENABLED',
          capabilities: Object.freeze([
            'quote',
            'ohlcv_1h',
            'ohlcv_4h',
            'ohlcv_1d',
            'contract_metadata',
            'roll_state',
            'continuous_series_research',
          ]),
        }),
        Object.freeze({
          providerId: 'fred-commodity',
          status: 'adapter_ready',
          credentialEnv: 'FRED_API_KEY',
          capabilities: Object.freeze(['energy_prices', 'wti_reference']),
        }),
      ]),
      missingProviders: Object.freeze(['nymex_live', 'cme_market_data', 'eia_live']),
      credentialDependencies: Object.freeze(['HELIOS_WTI_SANDBOX_ENABLED', 'FRED_API_KEY (external reference)']),
      externalDependencies: Object.freeze(['FRED WTI series (external-data)', 'NYMEX live feed (not connected)']),
      unavailableCapabilities: Object.freeze(['live WTI futures execution', 'real-time NYMEX depth']),
    }),
  ];

  const qualifiedCount = assetClasses.filter((a) => a.status === 'qualified').length;
  const partialCount = assetClasses.filter((a) => a.status === 'partial' || a.status === 'simulation_only').length;
  const missingCount = assetClasses.filter((a) => a.status === 'missing').length;

  return Object.freeze({
    reportId: 'helios-multi-asset-m05-m08-coverage',
    generatedAt: nowUtc,
    qualificationMarkers: Object.freeze({
      M05: null,
      M06: null,
      M07: null,
      M08: 'HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_QUALIFIED',
    }),
    assetClasses: Object.freeze(assetClasses),
    summary: Object.freeze({ qualifiedCount, partialCount, missingCount }),
  });
}
