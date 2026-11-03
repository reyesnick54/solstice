/**
 * Seris (Apache-2.0) strategy / autopilot pattern attribution — native HELIOS assimilation only.
 * Desktop runtime and live venue providers are not imported.
 *
 * Upstream: https://github.com/aowang-ai/seris
 * Reference: f73dbbb0cd7e3b52601abf905bb871cdb9098550
 */
export const HELIOS_NATIVE12_SERIS_UPSTREAM = Object.freeze({
  repository: 'aowang-ai/seris',
  referenceSha: 'f73dbbb0cd7e3b52601abf905bb871cdb9098550',
  license: 'Apache-2.0',
  adaptedSurfaces: Object.freeze([
    'strategy/source naming and review (strategy/files validStrategyName)',
    'backtest run summary + metrics hash (strategy/types BacktestRunSummary)',
    'durable autopilot run history cap (autopilot/engine HISTORY_CAP)',
    'observe → analyze research tick (autopilot/engine — research-only in HELIOS)',
    'simulation market context metadata (strategy/types BacktestMarket — no live venue)',
  ]),
});
