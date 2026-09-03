// @ts-nocheck
import type { Clock } from '../../config/src/clock.ts';
import type { Result } from '../../domain/src/result.ts';
import type { AccessResourceId } from './ids.ts';
import { decideAllocation, type AllocationEngineInput, type AllocationEngineResult } from './allocation/engine.ts';
import { DEFAULT_MECHANISM_POLICY } from './allocation/policy.ts';
import { buildVerifiedCapacityState } from './capacity.ts';
import type { VerifiedCapacityState } from './capacity.ts';
import type {
  AllocationRequest,
  ForbiddenInputProbe,
  MechanismSelectionPolicy,
  ScarcityEvaluationInput,
  ScarcityRefusal,
} from './scarcity/types.ts';
import type { AllocationMechanism } from './taxonomy.ts';

export type AccessFabricOptions = {
  readonly clock: Clock;
  readonly policy?: MechanismSelectionPolicy;
};

/**
 * SunRey Access Fabric — deterministic access-market intelligence.
 * Does not execute reservations, post journals, or issue Execution Authority.
 */
export class AccessFabricService {
  private readonly clock: Clock;
  private readonly policy: MechanismSelectionPolicy;

  constructor(options: AccessFabricOptions) {
    this.clock = options.clock;
    this.policy = options.policy ?? DEFAULT_MECHANISM_POLICY;
  }

  quoteAndAllocate(input: {
    readonly request: Omit<AllocationRequest, 'now'>;
    readonly capacity: VerifiedCapacityState;
    readonly scarcity?: Omit<ScarcityEvaluationInput, 'resourceId' | 'capacity' | 'now'>;
    readonly configuredMechanism?: AllocationMechanism;
    readonly forbiddenProbe?: ForbiddenInputProbe;
    readonly lotteryThresholdBps?: bigint;
  }): Result<AllocationEngineResult, ScarcityRefusal> {
    const now = this.clock.now();
    const engineInput: AllocationEngineInput = {
      scarcityInput: {
        resourceId: input.capacity.resourceId,
        capacity: input.capacity,
        now,
        ...(input.scarcity ?? {}),
      },
      request: { ...input.request, now },
      policy: this.policy,
      configuredMechanism: input.configuredMechanism,
      forbiddenProbe: input.forbiddenProbe,
      lotteryThresholdBps: input.lotteryThresholdBps,
    };
    return decideAllocation(engineInput);
  }

  buildCapacity(input: {
    readonly resourceId: AccessResourceId;
    readonly availableUnits: bigint;
    readonly totalUnits: bigint;
    readonly evidenceRefs: readonly string[];
    readonly verifiedAt?: string;
    readonly utilizationBps?: number;
    readonly qualityTier?: string;
    readonly locationCode?: string;
  }): VerifiedCapacityState {
    return buildVerifiedCapacityState({
      resourceId: input.resourceId,
      availableUnits: input.availableUnits,
      totalUnits: input.totalUnits,
      verifiedAt: input.verifiedAt ?? this.clock.now(),
      evidenceRefs: input.evidenceRefs,
      utilizationBps: input.utilizationBps,
      qualityTier: input.qualityTier,
      locationCode: input.locationCode,
    });
  }
}

export { decideAllocation } from './allocation/engine.ts';
export { DEFAULT_MECHANISM_POLICY, selectMechanism } from './allocation/policy.ts';
export { evaluateScarcity, buildAccessQuote, detectForbiddenInputs } from './scarcity/engine.ts';
export { SCARCITY_MODEL_V1, resolveScarcityModel } from './scarcity/model.ts';
export { buildVerifiedCapacityState, validateCapacityState, isCapacityStale } from './capacity.ts';
export * from './taxonomy.ts';
export * from './ids.ts';
export type {
  AccessQuote,
  AllocationDecision,
  AllocationRequest,
  MechanismSelectionPolicy,
  ScarcityEvaluationInput,
  ScarcityRefusal,
  ScarcityState,
  TaggedInput,
  AllocationBasis,
  ForbiddenInputProbe,
} from './scarcity/types.ts';
export type { VerifiedCapacityState, CapacityRefusal } from './capacity.ts';
export type { AllocationEngineResult } from './allocation/engine.ts';
