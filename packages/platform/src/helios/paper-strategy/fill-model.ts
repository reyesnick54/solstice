import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { QualificationTermsSnapshot } from '../executable-opportunity/types.ts';
import type { HeliosPaperFillAssumptions } from './types.ts';
import { HELIOS_PAPER_FILL_METHODOLOGY_VERSION } from './types.ts';

type MoneyLike = { readonly minorUnits: string; readonly currency: string };

function applyBps(baseMinor: bigint, bps: number, add: boolean): bigint {
  const adjustment = (baseMinor * BigInt(bps)) / 10_000n;
  return add ? baseMinor + adjustment : baseMinor - adjustment;
}

export function computePaperFillAssumptions(input: {
  readonly side: 'BUY' | 'SELL';
  readonly terms: QualificationTermsSnapshot;
  readonly quantityUnits: string;
  readonly spreadBps?: number;
  readonly slippageBps?: number;
  readonly now: UtcInstant;
}): HeliosPaperFillAssumptions {
  const referenceMidMinor = BigInt(input.terms.priceReference?.minorUnits ?? '0');
  const spreadBps = input.spreadBps ?? input.terms.spreadBps ?? 5;
  const slippageBps = input.slippageBps ?? 10;
  const halfSpreadBps = Math.round(spreadBps / 2);
  const totalAdverseBps = halfSpreadBps + slippageBps;
  const executionPriceMinor =
    input.side === 'BUY'
      ? applyBps(referenceMidMinor, totalAdverseBps, true)
      : applyBps(referenceMidMinor, totalAdverseBps, false);
  const shares = BigInt(input.quantityUnits) / 1_000_000_000n;
  const grossMinor = shares * executionPriceMinor;
  const feeBps = input.terms.feeMetadata?.[0]?.basisPoints ?? 0;
  const feeMinor = (grossMinor * BigInt(feeBps)) / 10_000n;
  const spreadCostMinor = (referenceMidMinor * BigInt(spreadBps) * shares) / 10_000n;
  const slippageCostMinor = (referenceMidMinor * BigInt(slippageBps) * shares) / 10_000n;

  return Object.freeze({
    methodologyVersion: HELIOS_PAPER_FILL_METHODOLOGY_VERSION,
    spreadBps,
    slippageBps,
    feeMinorUnits: feeMinor.toString(),
    feeCurrency: input.terms.priceReference?.currency ?? 'USD',
    referenceMidMinor: referenceMidMinor.toString(),
    executionPriceMinor: executionPriceMinor.toString(),
    dataTimestamp: input.terms.priceReference?.asOf ?? input.now,
  });
}

export function paperMoney(minorUnits: string, currency: string): MoneyLike {
  return Object.freeze({ minorUnits, currency });
}

export function grossNotionalFromAssumptions(
  assumptions: HeliosPaperFillAssumptions,
  quantityUnits: string,
): MoneyLike {
  const shares = BigInt(quantityUnits) / 1_000_000_000n;
  const gross = shares * BigInt(assumptions.executionPriceMinor);
  return paperMoney(gross.toString(), assumptions.feeCurrency);
}

export function netNotionalFromAssumptions(
  assumptions: HeliosPaperFillAssumptions,
  quantityUnits: string,
  side: 'BUY' | 'SELL',
): MoneyLike {
  const gross = grossNotionalFromAssumptions(assumptions, quantityUnits);
  const fee = BigInt(assumptions.feeMinorUnits);
  const grossMinor = BigInt(gross.minorUnits);
  const net = side === 'BUY' ? grossMinor + fee : grossMinor - fee;
  return paperMoney(net.toString(), assumptions.feeCurrency);
}

export function spreadCostFromAssumptions(assumptions: HeliosPaperFillAssumptions, quantityUnits: string): MoneyLike {
  const shares = BigInt(quantityUnits) / 1_000_000_000n;
  const spread = (BigInt(assumptions.referenceMidMinor) * BigInt(assumptions.spreadBps) * shares) / 10_000n;
  return paperMoney(spread.toString(), assumptions.feeCurrency);
}

export function slippageCostFromAssumptions(assumptions: HeliosPaperFillAssumptions, quantityUnits: string): MoneyLike {
  const shares = BigInt(quantityUnits) / 1_000_000_000n;
  const slip = (BigInt(assumptions.referenceMidMinor) * BigInt(assumptions.slippageBps) * shares) / 10_000n;
  return paperMoney(slip.toString(), assumptions.feeCurrency);
}
