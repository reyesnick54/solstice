/**
 * @deprecated Use `AlphaExchangeClearingChain` from `@solstice/sunrey-chain/exchange-clearing`.
 * Retained as a compatibility alias for in-process simulation tests.
 */
export {
  AlphaExchangeClearingChain as InMemoryNativeChain,
  createAlphaExchangeClearingChain,
} from '@solstice/sunrey-chain/exchange-clearing';

export type {
  ChainHolding as SimulatedHolding,
  ChainLock as SimulatedLock,
  ChainSettlementTx as SimulatedTx,
} from '@solstice/sunrey-chain/exchange-clearing';
