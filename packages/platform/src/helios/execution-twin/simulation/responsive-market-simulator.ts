/**
 * HELIOS CF08 — research-only responsive market model (Level 3).
 * Deterministic baseline: order-flow reaction, temporary + decaying permanent impact,
 * liquidity depletion, partial replenishment, and spread widening.
 * Optional future adapters (generative LOB, diffusion, agent-based) implement the same
 * interface; model outputs are never treated as factual.
 */

import type { UtcInstant } from '@solstice/domain';

import type { Level2Snapshot } from './types.ts';
import type { SimulatedOrderSide } from './taxonomy.ts';
import {
  HELIOS_CF08_DETERMINISTIC_MARKET_MODEL_ID,
  type ResponsiveMarketModelKind,
} from './counterfactual-taxonomy.ts';

export type ResponsiveMarketSimulatorConfig = {
  /** Impact numerator in minor units of mid price; scaled by depth (research tuning). */
  readonly temporaryImpactNumerator?: bigint;
  readonly permanentImpactNumerator?: bigint;
  readonly spreadWidenNumerator?: bigint;
  readonly replenishmentDivisor?: bigint;
  readonly maxTemporaryImpactMinor?: bigint;
  readonly maxPermanentImpactMinor?: bigint;
  readonly maxSpreadWidenMinor?: bigint;
};

const DEFAULTS = Object.freeze({
  temporaryImpactNumerator: 120n,
  permanentImpactNumerator: 40n,
  spreadWidenNumerator: 80n,
  replenishmentDivisor: 4n,
  maxTemporaryImpactMinor: 5_000n,
  maxPermanentImpactMinor: 2_000n,
  maxSpreadWidenMinor: 3_000n,
});

function capMinor(value: bigint, max: bigint): bigint {
  return value > max ? max : value;
}

function depthEstimate(snapshot: Level2Snapshot): bigint {
  const depthLevels = 5;
  let total = 0n;
  for (let i = 0; i < Math.min(depthLevels, snapshot.bids.length); i += 1) {
    total += snapshot.bids[i]!.sizeUnits;
  }
  for (let i = 0; i < Math.min(depthLevels, snapshot.asks.length); i += 1) {
    total += snapshot.asks[i]!.sizeUnits;
  }
  return total > 0n ? total : 1n;
}

function cloneSnapshot(snapshot: Level2Snapshot): Level2Snapshot {
  return Object.freeze({
    ...snapshot,
    bids: snapshot.bids.map((row) => Object.freeze({ ...row })),
    asks: snapshot.asks.map((row) => Object.freeze({ ...row })),
  });
}

export interface ResponsiveMarketSimulator {
  readonly modelId: string;
  /** Adapter kind; learned simulators must not set DETERMINISTIC_BASELINE unless equivalent. */
  readonly modelKind: ResponsiveMarketModelKind;
  adaptBookForHypotheticalOrder(input: {
    readonly snapshot: Level2Snapshot;
    readonly side: SimulatedOrderSide;
    readonly quantityUnits: bigint;
    readonly asOf: UtcInstant;
  }): Level2Snapshot;
}

/**
 * Deterministic CF08 baseline responsive model.
 */
export class DeterministicResponsiveMarketSimulator implements ResponsiveMarketSimulator {
  readonly modelId = HELIOS_CF08_DETERMINISTIC_MARKET_MODEL_ID;
  readonly modelKind = 'DETERMINISTIC_BASELINE' as const;
  private readonly cfg: Required<ResponsiveMarketSimulatorConfig>;

  constructor(config: ResponsiveMarketSimulatorConfig = {}) {
    this.cfg = {
      temporaryImpactNumerator: config.temporaryImpactNumerator ?? DEFAULTS.temporaryImpactNumerator,
      permanentImpactNumerator: config.permanentImpactNumerator ?? DEFAULTS.permanentImpactNumerator,
      spreadWidenNumerator: config.spreadWidenNumerator ?? DEFAULTS.spreadWidenNumerator,
      replenishmentDivisor: config.replenishmentDivisor ?? DEFAULTS.replenishmentDivisor,
      maxTemporaryImpactMinor: config.maxTemporaryImpactMinor ?? DEFAULTS.maxTemporaryImpactMinor,
      maxPermanentImpactMinor: config.maxPermanentImpactMinor ?? DEFAULTS.maxPermanentImpactMinor,
      maxSpreadWidenMinor: config.maxSpreadWidenMinor ?? DEFAULTS.maxSpreadWidenMinor,
    };
  }

  adaptBookForHypotheticalOrder(input: {
    readonly snapshot: Level2Snapshot;
    readonly side: SimulatedOrderSide;
    readonly quantityUnits: bigint;
    readonly asOf: UtcInstant;
  }): Level2Snapshot {
    const depth = depthEstimate(input.snapshot);
    const qty = input.quantityUnits > 0n ? input.quantityUnits : 1n;

    const temporaryRaw = (qty * this.cfg.temporaryImpactNumerator) / depth;
    const permanentRaw = (qty * this.cfg.permanentImpactNumerator) / depth;
    const spreadWidenRaw = (qty * this.cfg.spreadWidenNumerator) / depth;

    const temporary = capMinor(temporaryRaw, this.cfg.maxTemporaryImpactMinor);
    const permanent = capMinor(permanentRaw, this.cfg.maxPermanentImpactMinor);
    const spreadWiden = capMinor(spreadWidenRaw, this.cfg.maxSpreadWidenMinor);

    const signedTemporary = input.side === 'BUY' ? temporary : -temporary;
    const signedPermanent = input.side === 'BUY' ? permanent : -permanent;

    const snap = cloneSnapshot(input.snapshot);
    if (snap.bids.length === 0 || snap.asks.length === 0) {
      return snap;
    }

    const bestBid = snap.bids[0]!;
    const bestAsk = snap.asks[0]!;
    const mid = (bestBid.priceMinorUnits + bestAsk.priceMinorUnits) / 2n;
    const halfSpread = (bestAsk.priceMinorUnits - bestBid.priceMinorUnits) / 2n;
    const newMid = mid + signedTemporary + signedPermanent;
    const newHalfSpread = halfSpread + spreadWiden / 2n;
    const newBidPrice = newMid - newHalfSpread;
    const newAskPrice = newMid + newHalfSpread;

    let bids = snap.bids.map((row, index) => {
      if (index !== 0) {
        return row;
      }
      return Object.freeze({
        ...row,
        priceMinorUnits: newBidPrice,
      });
    });
    let asks = snap.asks.map((row, index) => {
      if (index !== 0) {
        return row;
      }
      return Object.freeze({
        ...row,
        priceMinorUnits: newAskPrice,
      });
    });

    if (input.side === 'BUY' && asks.length > 0) {
      const touch = asks[0]!;
      const consumed = qty > touch.sizeUnits ? touch.sizeUnits : qty;
      const replenished = consumed / this.cfg.replenishmentDivisor;
      const nextSize =
        touch.sizeUnits - consumed + replenished < 0n ? 0n : touch.sizeUnits - consumed + replenished;
      asks = asks.map((row, index) =>
        index === 0 ? Object.freeze({ ...row, sizeUnits: nextSize }) : row,
      );
    } else if (input.side === 'SELL' && bids.length > 0) {
      const touch = bids[0]!;
      const consumed = qty > touch.sizeUnits ? touch.sizeUnits : qty;
      const replenished = consumed / this.cfg.replenishmentDivisor;
      const nextSize =
        touch.sizeUnits - consumed + replenished < 0n ? 0n : touch.sizeUnits - consumed + replenished;
      bids = bids.map((row, index) =>
        index === 0 ? Object.freeze({ ...row, sizeUnits: nextSize }) : row,
      );
    }

    return Object.freeze({
      ...snap,
      observedAt: input.asOf,
      bids,
      asks,
    });
  }
}
