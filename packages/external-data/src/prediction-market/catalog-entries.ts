import { POLYMARKET_CLOB_CAPABILITIES, POLYMARKET_CLOB_RESEARCH_PROVIDER_ID } from './taxonomy.ts';

export const POLYMARKET_CLOB_CATALOG_ENTRIES = Object.freeze([
  Object.freeze({
    provider_id: POLYMARKET_CLOB_RESEARCH_PROVIDER_ID,
    display_name: 'Polymarket CLOB (research sandbox)',
    category: 'prediction_markets',
    capabilities: [...POLYMARKET_CLOB_CAPABILITIES],
    transaction_capability: false,
    live_trading: false,
    authority_class: 'reference_data',
    notes: 'Fixture-only assimilation of CLOB market structure; no private keys or live trading.',
  }),
]);
