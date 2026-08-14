export { ExecutionEngine } from './engine.ts';
export type { ExecutionMode, ExecutionResult, PaperFill, ShadowRecord } from './engine.ts';
export { PaperLedger } from './ledger/PaperLedger.ts';
export type { PaperJournal } from './ledger/PaperLedger.ts';
export { simulatePriceSeries, nextLcg } from './market-data.ts';
export type { SimulatedSeries } from './market-data.ts';
