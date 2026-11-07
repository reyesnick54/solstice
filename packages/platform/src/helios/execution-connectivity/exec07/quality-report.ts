import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { ExecutionAlgorithmKind } from './taxonomy.ts';
import { HELIOS_EXEC07_TCA_SCHEMA } from './taxonomy.ts';
import type { ExecutionQualityReport, TransactionCostAnalysis } from './types.ts';

export function validateExecutionQualityReport(input: {
  readonly transactionCost: TransactionCostAnalysis;
}): { readonly validated: boolean; readonly blockers: readonly string[] } {
  const blockers: string[] = [];
  if (!input.transactionCost.benchmarkConstructionComplete) {
    blockers.push('benchmark_construction_incomplete');
  }
  if (input.transactionCost.quantityFilledUnits <= 0n) {
    blockers.push('no_fill');
  }
  if (!input.transactionCost.dataComplete) {
    blockers.push('tca_data_incomplete');
  }
  return Object.freeze({
    validated: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}

export function buildExecutionQualityReport(input: {
  readonly orderId: string;
  readonly executionPlanId: string | null;
  readonly venueId: string;
  readonly providerId: string;
  readonly algorithmKind: ExecutionAlgorithmKind;
  readonly instrumentId: string;
  readonly transactionCost: TransactionCostAnalysis;
  readonly averageFillPriceMinor: bigint | null;
  readonly computedAt: UtcInstant;
}): ExecutionQualityReport {
  const gate = validateExecutionQualityReport({ transactionCost: input.transactionCost });
  const material = `${input.orderId}:${input.venueId}:${input.transactionCost.analysisId}`;
  const reportId = `exec07_eqr_${createHash('sha256').update(material).digest('hex').slice(0, 18)}`;
  return Object.freeze({
    reportId,
    schema: HELIOS_EXEC07_TCA_SCHEMA,
    orderId: input.orderId,
    executionPlanId: input.executionPlanId,
    venueId: input.venueId,
    providerId: input.providerId,
    algorithmKind: input.algorithmKind,
    instrumentId: input.instrumentId,
    transactionCost: input.transactionCost,
    averageFillPriceMinor: input.averageFillPriceMinor,
    validated: gate.validated,
    validationBlockers: gate.blockers,
    computedAt: input.computedAt,
  });
}
