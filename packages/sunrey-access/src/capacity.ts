import type { UtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { asVerifiedCapacityId, type AccessResourceId, type VerifiedCapacityId } from './ids.ts';
import type { CapacityRefusalCode } from './taxonomy.ts';

export type CapacityRefusal = {
  readonly code: CapacityRefusalCode;
  readonly message: string;
  readonly resourceId: AccessResourceId;
  readonly observedAt?: UtcInstant;
  readonly maxAgeMs?: number;
};

/**
 * Verified capacity state from ACCESS-05. Scarcity evaluation consumes only
 * verified capacity — never inferred or unverified projections.
 */
export type VerifiedCapacityState = {
  readonly capacityId: VerifiedCapacityId;
  readonly resourceId: AccessResourceId;
  readonly availableUnits: bigint;
  readonly totalUnits: bigint;
  /** Utilization in basis points (0–10_000). */
  readonly utilizationBps: number;
  readonly qualityTier: string;
  readonly locationCode: string;
  readonly verifiedAt: UtcInstant;
  readonly evidenceRefs: readonly string[];
};

export type CapacityValidationOptions = {
  readonly now: UtcInstant;
  readonly maxAgeMs: number;
  readonly requireEvidence?: boolean;
};

export function validateCapacityState(
  state: VerifiedCapacityState,
  options: CapacityValidationOptions,
): Result<VerifiedCapacityState, CapacityRefusal> {
  const base = {
    resourceId: state.resourceId,
    observedAt: state.verifiedAt,
    maxAgeMs: options.maxAgeMs,
  };

  if (state.totalUnits < 0n || state.availableUnits < 0n) {
    return err({ code: 'CAPACITY_UNVERIFIED', message: 'capacity units must be non-negative', ...base });
  }
  if (state.availableUnits > state.totalUnits) {
    return err({ code: 'CAPACITY_UNVERIFIED', message: 'available units cannot exceed total units', ...base });
  }
  if (state.utilizationBps < 0 || state.utilizationBps > 10_000) {
    return err({ code: 'CAPACITY_UNVERIFIED', message: 'utilization must be 0–10000 basis points', ...base });
  }
  if (options.requireEvidence !== false && state.evidenceRefs.length === 0) {
    return err({ code: 'CAPACITY_EVIDENCE_MISSING', message: 'verified capacity requires evidence references', ...base });
  }
  if (isCapacityStale(state, options.now, options.maxAgeMs)) {
    return err({ code: 'CAPACITY_STALE', message: 'verified capacity exceeds freshness window', ...base });
  }
  if (state.availableUnits === 0n) {
    return err({ code: 'CAPACITY_ZERO', message: 'no available capacity', ...base });
  }
  return ok(state);
}

export function isCapacityStale(state: VerifiedCapacityState, now: UtcInstant, maxAgeMs: number): boolean {
  const verifiedMs = Date.parse(state.verifiedAt);
  const nowMs = Date.parse(now);
  if (Number.isNaN(verifiedMs) || Number.isNaN(nowMs)) {
    return true;
  }
  return nowMs - verifiedMs > maxAgeMs;
}

export function capacityUtilizationRatio(state: VerifiedCapacityState): bigint {
  if (state.totalUnits === 0n) {
    return 0n;
  }
  return (state.totalUnits - state.availableUnits) * 10_000n / state.totalUnits;
}

export function buildVerifiedCapacityState(input: {
  readonly capacityId?: string;
  readonly resourceId: AccessResourceId;
  readonly availableUnits: bigint;
  readonly totalUnits: bigint;
  readonly utilizationBps?: number;
  readonly qualityTier?: string;
  readonly locationCode?: string;
  readonly verifiedAt: UtcInstant;
  readonly evidenceRefs: readonly string[];
}): VerifiedCapacityState {
  const utilizationBps =
    input.utilizationBps ??
    (input.totalUnits === 0n
      ? 0
      : Number(((input.totalUnits - input.availableUnits) * 10_000n) / input.totalUnits));
  return Object.freeze({
    capacityId: asVerifiedCapacityId(input.capacityId ?? `cap_${input.resourceId}`),
    resourceId: input.resourceId,
    availableUnits: input.availableUnits,
    totalUnits: input.totalUnits,
    utilizationBps,
    qualityTier: input.qualityTier ?? 'STANDARD',
    locationCode: input.locationCode ?? 'UNSCOPED',
    verifiedAt: input.verifiedAt,
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
  });
}
