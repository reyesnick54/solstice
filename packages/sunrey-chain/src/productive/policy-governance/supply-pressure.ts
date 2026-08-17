import type { NativeAssetSupplyState } from '../supply.ts';
import { supplyReconciles } from '../supply.ts';
import { UNCONFIGURED, type BudgetBound } from './types.ts';
import { analyzeIssuanceConcentration, type ConcentrationWarning } from './concentration.ts';
import { utilizationBps } from './budget.ts';
import type { ConcentrationReport } from '../../oracle/production/concentration.ts';

export type MoonReySupplyPressureReport = {
  readonly classification: 'ENGINEERING_ECONOMIC_SIMULATION';
  readonly epoch: number;
  readonly issuancePerEpoch: bigint;
  readonly issuanceByCategory: Readonly<Record<string, bigint>>;
  readonly issuanceConcentration: readonly ConcentrationWarning[];
  readonly productiveOutputGrowth: bigint;
  readonly moonreySupplyGrowth: bigint;
  readonly lockedQuantity: bigint;
  readonly circulatingQuantity: bigint;
  readonly exchangeLiquidityReference: bigint | typeof UNCONFIGURED;
  readonly categoryDominance: readonly ConcentrationWarning[];
  readonly capUtilization: Readonly<Record<string, bigint | typeof UNCONFIGURED>>;
  readonly supplyReconciles: boolean;
  readonly automaticMarketPriceClaim: false;
};

export function buildSupplyPressureReport(input: {
  readonly epoch: number;
  readonly issuancePerEpoch: bigint;
  readonly issuanceByCategory: Readonly<Record<string, bigint>>;
  readonly issuanceByOperator: Readonly<Record<string, bigint>>;
  readonly issuanceByObjectClass: Readonly<Record<string, bigint>>;
  readonly issuanceByRegion: Readonly<Record<string, bigint>>;
  readonly priorEpochIssuance: bigint;
  readonly priorSupply: bigint;
  readonly supply: NativeAssetSupplyState;
  readonly warnAtBps: number;
  readonly categoryCap: BudgetBound;
  readonly epochCap: BudgetBound;
  readonly oracleConcentration?: ConcentrationReport;
  readonly exchangeLiquidityReference?: bigint | typeof UNCONFIGURED;
}): MoonReySupplyPressureReport {
  const total = Object.values(input.issuanceByCategory).reduce((sum, value) => sum + value, 0n);
  const concentration = analyzeIssuanceConcentration({
    issuanceByCategory: input.issuanceByCategory,
    issuanceByOperator: input.issuanceByOperator,
    issuanceByObjectClass: input.issuanceByObjectClass,
    issuanceByRegion: input.issuanceByRegion,
    totalIssuance: total,
    warnAtBps: input.warnAtBps,
    oracleConcentration: input.oracleConcentration,
  });
  return Object.freeze({
    classification: 'ENGINEERING_ECONOMIC_SIMULATION',
    epoch: input.epoch,
    issuancePerEpoch: input.issuancePerEpoch,
    issuanceByCategory: input.issuanceByCategory,
    issuanceConcentration: concentration,
    productiveOutputGrowth: input.issuancePerEpoch - input.priorEpochIssuance,
    moonreySupplyGrowth: input.supply.issued - input.priorSupply,
    lockedQuantity: input.supply.locked,
    circulatingQuantity: input.supply.holdings - input.supply.locked,
    exchangeLiquidityReference: input.exchangeLiquidityReference ?? UNCONFIGURED,
    categoryDominance: concentration.filter((row) => row.kind === 'CATEGORY_DOMINANCE'),
    capUtilization: Object.freeze({
      category: utilizationBps(total, input.categoryCap),
      epoch: utilizationBps(input.issuancePerEpoch, input.epochCap),
    }),
    supplyReconciles: supplyReconciles(input.supply),
    automaticMarketPriceClaim: false,
  });
}
