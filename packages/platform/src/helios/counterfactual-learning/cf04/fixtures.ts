import type { CounterfactualTrainingRow, OutcomeVector } from './types.ts';

function outcomeStub(seed: number): OutcomeVector {
  const s = (x: number) => Math.sin(x * 0.13 + seed) * 0.01 + seed * 1e-4;
  return Object.freeze({
    netReturn: s(1),
    excessReturn: s(2) * 0.9,
    drawdown: Math.abs(s(3)),
    realizedVolatility: Math.abs(s(4)) + 0.02,
    turnover: Math.abs(s(5)) + 0.05,
    transactionCost: Math.abs(s(6)) * 0.001,
    slippage: Math.abs(s(7)) * 0.0005,
    capitalUsage: 0.5 + Math.abs(s(8)) * 0.2,
    tailLoss: Math.abs(s(9)),
    holdingPeriod: 5 + Math.floor(Math.abs(seed % 12)),
    capacityUsage: 0.4 + Math.abs(s(10)) * 0.3,
  });
}

/** Deterministic panel for simulation tests: unique issuer/instrument per row avoids fold leakage faults. */
export function fixtureCf04TrainingRows(count = 24): readonly CounterfactualTrainingRow[] {
  const regimes = ['RISK_OFF', 'NEUTRAL', 'RISK_ON', 'STRESS'] as const;
  const liquidity = ['DEEP', 'NORMAL', 'THIN', 'ILLIQUID'] as const;
  const rows: CounterfactualTrainingRow[] = [];
  for (let i = 0; i < count; i += 1) {
    const asOf = 1_700_000_000_000 + i * 86_400_000;
    rows.push(
      Object.freeze({
        rowId: `cf04_row_${i}`,
        asOfUtcMs: asOf,
        outcomeObservedUtcMs: asOf + 3_600_000,
        issuerId: `iss_${i}`,
        instrumentId: `inst_${i}`,
        regime: regimes[i % regimes.length]!,
        liquidityBucket: liquidity[i % liquidity.length]!,
        actionId: i % 2 === 0 ? 'act_hold' : 'act_rotate',
        features: Object.freeze({
          featureId: `aaf_cf04_demo`,
          certifiedAtUtcMs: asOf,
          certificationMarker: 'AAF_CERT_SIM',
          values: Object.freeze([Math.sin(i * 0.2), Math.cos(i * 0.15), (i % 7) * 0.1]),
        }),
        realized: outcomeStub(i),
      }),
    );
  }
  return Object.freeze(rows);
}
