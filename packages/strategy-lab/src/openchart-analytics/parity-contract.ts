/**
 * Shared parity contract with HELIOS feature-fabric OpenChart port (Strategy Lab cannot import platform).
 */

export const OPENCHART_PARITY_UPSTREAM_SHA = '8109466bfb5d44c32e0e03e9337eaca48b837ab4' as const;

/** tea-run.test.ts — ta.sma(close, 2) on [10, 20, 30] */
export const OPENCHART_TEA_SMA_LENGTH2_CLOSES = Object.freeze([10, 20, 30]);

export const OPENCHART_TEA_SMA_LENGTH2_EXPECTED = Object.freeze([Number.NaN, 15, 25]);
