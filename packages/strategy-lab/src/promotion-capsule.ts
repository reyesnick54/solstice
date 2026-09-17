import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { SimulationPlan } from './compiler.ts';
import {
  asStrategyCapsuleId,
  type StrategyCapsuleId,
  type StrategyId,
  type StrategyVersion,
} from './ids.ts';
import type { StrategySpecification } from './specification.ts';
import type { StrategyFailure } from './types.ts';

export type PromotionCapsuleEvidenceRef = {
  readonly evidenceKind: 'VALIDATION' | 'BACKTEST' | 'EXPERIMENT' | 'EXTERNAL';
  readonly refId: string;
  readonly hash: string;
};

/** H18 promotion eligibility capsule; distinct from H17 evaluation StrategyCapsule. */
export type PromotionCapsule = {
  readonly capsuleId: StrategyCapsuleId;
  readonly strategyId: StrategyId;
  readonly version: StrategyVersion;
  readonly fingerprint: string;
  readonly specification: StrategySpecification;
  readonly compiledHash: string | null;
  readonly compilerVersion: string | null;
  readonly instrumentUniverse: readonly string[];
  readonly featureDependencies: readonly string[];
  readonly dataDependencies: readonly string[];
  readonly costAssumptionsHash: string;
  readonly executionAssumptionsHash: string;
  readonly evidenceRefs: readonly PromotionCapsuleEvidenceRef[];
  readonly schemaDefects: readonly string[];
  readonly subjectId: string;
  readonly frozenAt: UtcInstant;
  readonly simulationOnly: true;
  readonly liveEligible: false;
};

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}

function hashCanonical(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function freezePromotionCapsule(input: {
  readonly specification: StrategySpecification;
  readonly plan?: SimulationPlan | null;
  readonly evidenceRefs?: readonly PromotionCapsuleEvidenceRef[];
  readonly schemaDefects?: readonly string[];
  readonly subjectId: string;
  readonly frozenAt: UtcInstant;
}): Result<PromotionCapsule, StrategyFailure> {
  const defects = input.schemaDefects ?? [];
  if (defects.length > 0) {
    return err({
      code: 'PROMOTION_GATE_FAILED',
      message: `Strategy Capsule has unresolved schema/config defects: ${defects.join(', ')}`,
    });
  }
  if (input.specification.instrumentUniverse.length === 0) {
    return err({
      code: 'PROMOTION_GATE_FAILED',
      message: 'Strategy Capsule requires a defined instrument universe',
    });
  }
  const fingerprintMaterial = canonicalJson({
    strategyId: input.specification.strategyId,
    version: input.specification.version,
    compiledHash: input.plan?.compiledHash ?? null,
    instrumentUniverse: input.specification.instrumentUniverse,
    requiredData: input.specification.requiredData,
    transactionCosts: input.specification.transactionCosts,
    entry: input.specification.entryConditions,
    exit: input.specification.exitConditions,
    target: input.specification.targetAllocation,
  });
  const fingerprint = createHash('sha256').update(fingerprintMaterial).digest('hex');
  const capsuleId = asStrategyCapsuleId(
    `scap_${input.specification.strategyId.slice(4)}_${input.specification.version}`,
  );
  return ok(
    Object.freeze({
      capsuleId,
      strategyId: input.specification.strategyId,
      version: input.specification.version,
      fingerprint,
      specification: input.specification,
      compiledHash: input.plan?.compiledHash ?? null,
      compilerVersion: input.plan?.compilerVersion ?? null,
      instrumentUniverse: Object.freeze([...input.specification.instrumentUniverse]),
      featureDependencies: Object.freeze([...input.specification.approvedSignalRefs.map((r) => `${r.modelId}@${r.version}`)]),
      dataDependencies: Object.freeze([...input.specification.requiredData]),
      costAssumptionsHash: hashCanonical(input.specification.transactionCosts),
      executionAssumptionsHash: hashCanonical({
        rebalanceCadence: input.specification.rebalanceCadence,
        cashAllocationBps: input.specification.cashAllocationBps,
        riskBudgetId: input.specification.riskBudgetId,
      }),
      evidenceRefs: Object.freeze([...(input.evidenceRefs ?? [])]),
      schemaDefects: Object.freeze([]),
      subjectId: input.subjectId,
      frozenAt: input.frozenAt,
      simulationOnly: true,
      liveEligible: false,
    }),
  );
}
