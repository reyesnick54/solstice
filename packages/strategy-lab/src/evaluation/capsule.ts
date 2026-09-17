import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ParameterSet } from '../backtest.ts';
import type { SimulationPlan } from '../compiler.ts';
import type { StrategySpecification } from '../specification.ts';
import type { StrategyFailure, TransactionCostAssumptions } from '../types.ts';
import { asStrategyCapsuleId, asStrategyCapsuleVersion, type StrategyCapsuleId, type StrategyCapsuleVersion } from './ids.ts';
import { DEFAULT_CONSERVATIVE_LATENCY } from './latency-model.ts';
import { FILL_MODEL_VERSION, type LatencyModelSpec } from './types.ts';

export const STRATEGY_CAPSULE_SCHEMA = 'sunrey.strategy-lab.capsule.v1' as const;

export type StrategyCapsule = {
  readonly schema: typeof STRATEGY_CAPSULE_SCHEMA;
  readonly capsuleId: StrategyCapsuleId;
  readonly version: StrategyCapsuleVersion;
  readonly specification: StrategySpecification;
  readonly plan: SimulationPlan;
  readonly parameterSet: ParameterSet;
  readonly fingerprint: string;
  readonly costSpec: TransactionCostAssumptions;
  readonly fillModelVersion: typeof FILL_MODEL_VERSION;
  readonly latencyModel: LatencyModelSpec;
  readonly frozenAt: UtcInstant;
  readonly immutable: true;
};

function canonicalCapsule(input: Omit<StrategyCapsule, 'fingerprint' | 'immutable' | 'capsuleId'>): string {
  return JSON.stringify(
    {
      schema: input.schema,
      version: input.version,
      specificationId: input.specification.specificationId,
      strategyId: input.specification.strategyId,
      strategyVersion: input.specification.version,
      compiledHash: input.plan.compiledHash,
      compilerVersion: input.plan.compilerVersion,
      parameterSet: input.parameterSet,
      costSpec: {
        ...input.costSpec,
        commissionMinorPerShare: input.costSpec.commissionMinorPerShare.toString(),
        spreadMinor: input.costSpec.spreadMinor.toString(),
        slippageMinor: input.costSpec.slippageMinor.toString(),
        otherCostMinor: input.costSpec.otherCostMinor.toString(),
      },
      fillModelVersion: input.fillModelVersion,
      latencyModel: input.latencyModel,
      frozenAt: input.frozenAt,
    },
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
  );
}

export function computeCapsuleFingerprint(
  input: Omit<StrategyCapsule, 'fingerprint' | 'immutable' | 'capsuleId'>,
): string {
  return createHash('sha256').update(canonicalCapsule(input)).digest('hex');
}

export function freezeStrategyCapsule(input: {
  readonly capsuleId?: StrategyCapsuleId;
  readonly version: StrategyCapsuleVersion;
  readonly specification: StrategySpecification;
  readonly plan: SimulationPlan;
  readonly parameterSet: ParameterSet;
  readonly costSpec?: TransactionCostAssumptions;
  readonly latencyModel?: LatencyModelSpec;
  readonly frozenAt: UtcInstant;
}): Result<StrategyCapsule, StrategyFailure> {
  if (input.specification.version.length === 0) {
    return err({ code: 'UNVERSIONED_STRATEGY', message: 'strategy capsule version is required' });
  }
  const costSpec = input.costSpec ?? input.specification.transactionCosts;
  const latencyModel = input.latencyModel ?? DEFAULT_CONSERVATIVE_LATENCY;
  const body = {
    schema: STRATEGY_CAPSULE_SCHEMA,
    version: input.version,
    specification: input.specification,
    plan: input.plan,
    parameterSet: input.parameterSet,
    costSpec,
    fillModelVersion: FILL_MODEL_VERSION,
    latencyModel,
    frozenAt: input.frozenAt,
  };
  const fingerprint = computeCapsuleFingerprint(body);
  return ok(
    Object.freeze({
      ...body,
      capsuleId: input.capsuleId ?? asStrategyCapsuleId(`scap_${fingerprint.slice(0, 20)}`),
      fingerprint,
      immutable: true as const,
    }),
  );
}

export function verifyCapsuleFingerprint(capsule: StrategyCapsule): boolean {
  const { capsuleId: _id, fingerprint, immutable: _imm, ...rest } = capsule;
  return computeCapsuleFingerprint(rest) === fingerprint;
}
