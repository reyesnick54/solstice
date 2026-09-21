import { M09_QQQ_INSTRUMENT_ID, M09_SPY_INSTRUMENT_ID } from '../m09/ids.ts';
import {
  CRYPTO_BTC_USD_ASSET_ID,
  CRYPTO_ETH_USD_ASSET_ID,
} from '../multi-asset/constants.ts';
/** Canonical GLD ETF id — matches M07 capital-market registry; not interchangeable with futures. */
export const M12_GLD_ETF_INSTRUMENT_ID = 'SECURITY:US:GLD:ARCX' as const;

/** COMEX gold continuous research series — distinct from GLD; research-only pairing. */
export const M12_GOLD_FUTURES_CONTINUOUS_ID = 'FUTURES:US:GC:COMEX:CONTINUOUS' as const;

/** Canonical SPY/QQQ equity ETF pair for relative-value research. */
export const M12_SPY_QQQ_PAIR_ID = 'pair_helios_m12_spy_qqq_v1' as const;

/** Canonical BTC/ETH crypto pair for relative-value research. */
export const M12_BTC_ETH_PAIR_ID = 'pair_helios_m12_btc_eth_v1' as const;

/**
 * Gold-related pair: GLD ETF vs COMEX continuous research series.
 * Identity differences are explicit — not interchangeable instruments.
 */
export const M12_GLD_GC_RESEARCH_PAIR_ID = 'pair_helios_m12_gld_gc_research_v1' as const;

export const M12_PAIR_UNIVERSE = Object.freeze([
  M12_SPY_QQQ_PAIR_ID,
  M12_BTC_ETH_PAIR_ID,
  M12_GLD_GC_RESEARCH_PAIR_ID,
] as const);

export type M12PairId = (typeof M12_PAIR_UNIVERSE)[number];

export const M12_BAR_INTERVAL = '1h' as const;

export const M12_PAIR_DEFINITIONS = Object.freeze({
  [M12_SPY_QQQ_PAIR_ID]: Object.freeze({
    pairId: M12_SPY_QQQ_PAIR_ID,
    legAInstrumentId: M09_SPY_INSTRUMENT_ID,
    legBInstrumentId: M09_QQQ_INSTRUMENT_ID,
    assetClassA: 'ETF',
    assetClassB: 'ETF',
    hedgeMethod: 'ROLLING_BETA',
    identityMismatchAcknowledged: false,
    researchOnly: false,
  }),
  [M12_BTC_ETH_PAIR_ID]: Object.freeze({
    pairId: M12_BTC_ETH_PAIR_ID,
    legAInstrumentId: CRYPTO_BTC_USD_ASSET_ID,
    legBInstrumentId: CRYPTO_ETH_USD_ASSET_ID,
    assetClassA: 'CRYPTO',
    assetClassB: 'CRYPTO',
    hedgeMethod: 'ROLLING_BETA',
    identityMismatchAcknowledged: false,
    researchOnly: false,
  }),
  [M12_GLD_GC_RESEARCH_PAIR_ID]: Object.freeze({
    pairId: M12_GLD_GC_RESEARCH_PAIR_ID,
    legAInstrumentId: M12_GLD_ETF_INSTRUMENT_ID,
    legBInstrumentId: M12_GOLD_FUTURES_CONTINUOUS_ID,
    assetClassA: 'ETF_PROXY',
    assetClassB: 'CONTINUOUS_RESEARCH',
    hedgeMethod: 'FIXED_RATIO',
    identityMismatchAcknowledged: true,
    researchOnly: true,
  }),
});

export type M12PairDefinition = (typeof M12_PAIR_DEFINITIONS)[M12PairId];

export function resolveM12PairDefinition(pairId: M12PairId): M12PairDefinition {
  return M12_PAIR_DEFINITIONS[pairId];
}
