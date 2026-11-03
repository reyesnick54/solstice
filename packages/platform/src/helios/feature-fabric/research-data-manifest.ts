/**
 * Feature manifest bindings for TradingAgents-native research data pulls.
 * Composes with OS10 fundamental fabric and AAF revision ledger — does not duplicate AAF feature architecture.
 */

import { HELIOS_FUNDAMENTAL_FEATURE_SCHEMA } from './types.ts';

export const HELIOS_RESEARCH_DATA_MANIFEST_SCHEMA = 'sunrey.helios.research-data-manifest.v1' as const;

export type ResearchDataManifestEntry = {
  readonly entryId: string;
  readonly dataMethod: string;
  readonly providerChain: readonly string[];
  readonly pitPolicy: 'knowable_at' | 'as_of_trade_date';
  readonly revisionLedgerBound: boolean;
  readonly featureSchemaRef: typeof HELIOS_FUNDAMENTAL_FEATURE_SCHEMA | null;
};

export type HeliosResearchDataManifest = {
  readonly schema: typeof HELIOS_RESEARCH_DATA_MANIFEST_SCHEMA;
  readonly upstreamId: 'tradingagents';
  readonly upstreamSha: 'c4544913a14ed3df5f1ed7b9e8483270ce20682a';
  readonly entries: readonly ResearchDataManifestEntry[];
};

export function defaultTradingAgentsResearchDataManifest(): HeliosResearchDataManifest {
  return Object.freeze({
    schema: HELIOS_RESEARCH_DATA_MANIFEST_SCHEMA,
    upstreamId: 'tradingagents',
    upstreamSha: 'c4544913a14ed3df5f1ed7b9e8483270ce20682a',
    entries: Object.freeze([
      Object.freeze({
        entryId: 'fundamentals.sec_edgar',
        dataMethod: 'get_income_statement',
        providerChain: Object.freeze(['sec_edgar', 'yfinance']),
        pitPolicy: 'knowable_at',
        revisionLedgerBound: true,
        featureSchemaRef: HELIOS_FUNDAMENTAL_FEATURE_SCHEMA,
      }),
      Object.freeze({
        entryId: 'macro.fred',
        dataMethod: 'get_macro_indicators',
        providerChain: Object.freeze(['fred']),
        pitPolicy: 'as_of_trade_date',
        revisionLedgerBound: false,
        featureSchemaRef: null,
      }),
      Object.freeze({
        entryId: 'market.yfinance',
        dataMethod: 'get_stock_data',
        providerChain: Object.freeze(['yfinance']),
        pitPolicy: 'as_of_trade_date',
        revisionLedgerBound: false,
        featureSchemaRef: null,
      }),
    ]),
  });
}
