import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import { executionScheduleIdFor } from './ids.ts';
import type { ExecutionAlgorithmKind } from './taxonomy.ts';
import type { ExecutionSchedule, ExecutionScheduleSlice, ParentOrder } from './types.ts';

function msToInstant(startMs: number): UtcInstant {
  return asUtcInstant(new Date(startMs).toISOString());
}

function sliceTimes(startAt: UtcInstant, endAt: UtcInstant, intervalMs: number): readonly UtcInstant[] {
  const startMs = Date.parse(startAt);
  const endMs = Date.parse(endAt);
  const out: UtcInstant[] = [];
  for (let t = startMs; t < endMs; t += intervalMs) {
    out.push(msToInstant(t));
  }
  if (out.length === 0) {
    out.push(startAt);
  }
  return Object.freeze(out);
}

function distributeQuantity(total: bigint, slices: number): readonly bigint[] {
  if (slices <= 0) {
    return Object.freeze([total]);
  }
  const base = total / BigInt(slices);
  const remainder = total % BigInt(slices);
  const rows: bigint[] = [];
  for (let i = 0; i < slices; i += 1) {
    rows.push(base + (i < Number(remainder) ? 1n : 0n));
  }
  return Object.freeze(rows);
}

function vwapWeights(parent: ParentOrder, sliceCount: number, profileBps: readonly number[]): readonly number[] {
  if (profileBps.length === sliceCount) {
    return profileBps;
  }
  if (parent.algorithmKind !== 'VWAP') {
    return Object.freeze(Array.from({ length: sliceCount }, () => Math.floor(10_000 / sliceCount)));
  }
  return Object.freeze(Array.from({ length: sliceCount }, () => Math.floor(10_000 / sliceCount)));
}

function sliceQuantitiesForKind(
  parent: ParentOrder,
  sliceCount: number,
  profileBps: readonly number[],
  intervalVolumeUnits: bigint,
): readonly bigint[] {
  const total = parent.authorizedQuantityUnits;
  switch (parent.algorithmKind) {
    case 'MARKET':
    case 'LIMIT':
    case 'PASSIVE_LIMIT':
    case 'AGGRESSIVE_LIMIT':
      return Object.freeze([total]);
    case 'TWAP':
    case 'ARRIVAL_PRICE':
      return distributeQuantity(total, sliceCount);
    case 'VWAP': {
      const weights = vwapWeights(parent, sliceCount, profileBps);
      const sum = weights.reduce((acc, row) => acc + row, 0) || 10_000;
      const rows: bigint[] = [];
      let allocated = 0n;
      for (let i = 0; i < sliceCount; i += 1) {
        const isLast = i === sliceCount - 1;
        if (isLast) {
          rows.push(total - allocated);
        } else {
          const qty = (total * BigInt(weights[i] ?? 0)) / BigInt(sum);
          rows.push(qty);
          allocated += qty;
        }
      }
      return Object.freeze(rows);
    }
    case 'POV': {
      const capBps = Math.min(
        parent.participation.participationCapBps,
        parent.participation.mandateParticipationCapBps,
        parent.participation.riskParticipationCapBps,
      );
      if (intervalVolumeUnits <= 0n) {
        return distributeQuantity(total, sliceCount);
      }
      const perSlice = (intervalVolumeUnits * BigInt(capBps)) / 10_000n;
      const rows: bigint[] = [];
      let remaining = total;
      for (let i = 0; i < sliceCount && remaining > 0n; i += 1) {
        const qty = perSlice > remaining ? remaining : perSlice;
        rows.push(qty);
        remaining -= qty;
      }
      if (remaining > 0n && rows.length > 0) {
        rows[rows.length - 1] = (rows[rows.length - 1] ?? 0n) + remaining;
      }
      return Object.freeze(rows);
    }
    case 'IMPLEMENTATION_SHORTFALL': {
      const even = distributeQuantity(total, sliceCount);
      const rows = [...even];
      if (rows.length >= 2) {
        const frontLoad = rows[0] ?? 0n;
        rows[0] = frontLoad + (rows[rows.length - 1] ?? 0n) / 4n;
        rows[rows.length - 1] = (rows[rows.length - 1] ?? 0n) - (rows[rows.length - 1] ?? 0n) / 4n;
      }
      return Object.freeze(rows);
    }
    default:
      return distributeQuantity(total, sliceCount);
  }
}

export function buildExecutionSchedule(input: {
  readonly parent: ParentOrder;
  readonly createdAt: UtcInstant;
  readonly intervalVolumeUnits: bigint;
  readonly vwapProfileWeightsBps?: readonly number[];
}): ExecutionSchedule {
  const releaseTimes = sliceTimes(
    input.parent.horizon.startAt,
    input.parent.horizon.endAt,
    input.parent.horizon.sliceIntervalMs,
  );
  const sliceCount = releaseTimes.length;
  const quantities = sliceQuantitiesForKind(
    input.parent,
    sliceCount,
    input.vwapProfileWeightsBps ?? [],
    input.intervalVolumeUnits,
  );
  const slices: ExecutionScheduleSlice[] = [];
  for (let i = 0; i < sliceCount; i += 1) {
    slices.push(
      Object.freeze({
        sliceIndex: i,
        releaseAt: releaseTimes[i]!,
        quantityUnits: quantities[i] ?? 0n,
        targetParticipationBps:
          input.parent.algorithmKind === 'POV'
            ? Math.min(
                input.parent.participation.participationCapBps,
                input.parent.participation.mandateParticipationCapBps,
                input.parent.participation.riskParticipationCapBps,
              )
            : null,
      }),
    );
  }
  const scheduleId = executionScheduleIdFor(
    `${input.parent.parentOrderId}:${input.parent.algorithmKind}:${sliceCount}`,
  );
  return Object.freeze({
    scheduleId,
    parentOrderId: input.parent.parentOrderId,
    algorithmKind: input.parent.algorithmKind,
    slices: Object.freeze(slices),
    createdAt: input.createdAt,
    deterministic: true,
  });
}

export function algorithmKindUsesLimit(kind: ExecutionAlgorithmKind): boolean {
  return kind !== 'MARKET';
}
