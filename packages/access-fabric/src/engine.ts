import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { newPersonalAccessEnvelopeId } from './ids.ts';
import { assertAccessEntitlementInvariants, scanForbiddenAccessPayload } from './invariants.ts';
import { policyDecisionIndex } from './policy-port.ts';
import {
  activeReservationsTotal,
  nextReplenishmentAt,
  replenishmentWindow,
  usageInWindow,
} from './replenishment.ts';
import type {
  AccessEntitlement,
  AccessEntitlementEngineInput,
  AccessEntitlementEngineResult,
  AccessFabricFailure,
  AccessMandateConstraint,
  EligibleAccessRequest,
  PersonalAccessEnvelope,
} from './types.ts';

type UsageSlice = {
  readonly consumedAt: UtcInstant;
  readonly quantity: bigint;
};

type ReservationSlice = {
  readonly quantity: bigint;
  readonly expiresAt: UtcInstant;
};

function failure(code: AccessFabricFailure['code'], message: string): AccessFabricFailure {
  return Object.freeze({ code, message });
}

function instantMs(value: string): number {
  return Date.parse(value);
}

function jurisdictionAllowed(
  entitlement: AccessEntitlement,
  capability: AccessEntitlementEngineInput['jurisdictionCapability'],
): boolean {
  if (!capability.permittedJurisdictions.includes(entitlement.jurisdiction)) {
    return false;
  }
  if (
    capability.geographicScopes.length > 0 &&
    !capability.geographicScopes.includes(entitlement.geographicScope) &&
    entitlement.geographicScope !== 'GLOBAL'
  ) {
    return false;
  }
  return capability.actorJurisdiction === entitlement.jurisdiction || capability.permittedJurisdictions.includes(entitlement.jurisdiction);
}

function mandateAllows(
  entitlement: AccessEntitlement,
  mandates: readonly AccessMandateConstraint[],
): { readonly allowed: boolean; readonly maxQuantity?: bigint } {
  if (mandates.length === 0) {
    return { allowed: true };
  }
  for (const mandate of mandates) {
    if (mandate.allowedCategories && !mandate.allowedCategories.includes(entitlement.category)) {
      return { allowed: false };
    }
    if (mandate.allowedPurposes && !mandate.allowedPurposes.includes(entitlement.purpose)) {
      return { allowed: false };
    }
    if (mandate.allowedJurisdictions && !mandate.allowedJurisdictions.includes(entitlement.jurisdiction)) {
      return { allowed: false };
    }
  }
  const caps = mandates
    .map((mandate) => mandate.maxQuantityPerRequest)
    .filter((value): value is bigint => value !== undefined);
  if (caps.length === 0) {
    return { allowed: true };
  }
  return { allowed: true, maxQuantity: caps.reduce((min, value) => (value < min ? value : min)) };
}

function dedupeUsage<T extends { readonly eventId: string }>(
  usage: readonly T[],
  processedEventIds?: ReadonlySet<string>,
): readonly T[] {
  const seen = new Set(processedEventIds ?? []);
  const out: T[] = [];
  for (const record of usage) {
    if (seen.has(record.eventId)) {
      continue;
    }
    seen.add(record.eventId);
    out.push(record);
  }
  return Object.freeze(out);
}

function remainingCapacity(
  entitlement: AccessEntitlement,
  input: AccessEntitlementEngineInput,
  usageForEntitlement: readonly UsageSlice[],
  reservationsForEntitlement: readonly ReservationSlice[],
): bigint {
  const window = replenishmentWindow(entitlement.replenishment.kind, input.evaluatedAt, entitlement.replenishment);
  const periodCapacity =
    entitlement.replenishment.kind === 'NONE' || entitlement.replenishment.kind === 'FIXED_WINDOW'
      ? entitlement.capacity
      : entitlement.replenishment.quantityPerWindow;
  const consumed = usageInWindow(usageForEntitlement, window.windowStartAt, window.windowEndAt);
  const reserved = activeReservationsTotal(reservationsForEntitlement, input.evaluatedAt);
  const remaining = periodCapacity - consumed - reserved;
  return remaining > 0n ? remaining : 0n;
}

function evaluateEntitlement(
  entitlement: AccessEntitlement,
  input: AccessEntitlementEngineInput,
  policyById: ReadonlyMap<string, { readonly eligible: boolean; readonly policyRef: string }>,
): Result<EligibleAccessRequest | null, AccessFabricFailure> {
  const invariant = assertAccessEntitlementInvariants(entitlement);
  if (!invariant.ok) {
    return invariant;
  }
  const now = instantMs(input.evaluatedAt);
  if (now >= instantMs(entitlement.expiry) || now >= instantMs(entitlement.endAt)) {
    return ok(null);
  }
  if (now < instantMs(entitlement.startAt)) {
    return ok(null);
  }
  if (!jurisdictionAllowed(entitlement, input.jurisdictionCapability)) {
    return ok(null);
  }
  const policy = policyById.get(entitlement.entitlementId);
  if (policy && !policy.eligible) {
    return ok(null);
  }
  const mandate = mandateAllows(entitlement, input.mandates);
  if (!mandate.allowed) {
    return ok(null);
  }

  const usageForEntitlement = dedupeUsage(
    input.usage.filter((record) => record.entitlementId === entitlement.entitlementId),
    input.processedEventIds,
  );
  const reservationsForEntitlement = input.reservations.filter(
    (reservation) => reservation.entitlementId === entitlement.entitlementId,
  );
  let remaining = remainingCapacity(entitlement, input, usageForEntitlement, reservationsForEntitlement);
  if (mandate.maxQuantity !== undefined && remaining > mandate.maxQuantity) {
    remaining = mandate.maxQuantity;
  }
  if (remaining <= 0n) {
    return ok(null);
  }

  return ok({
    entitlementId: entitlement.entitlementId,
    category: entitlement.category,
    remainingCapacity: remaining,
    purpose: entitlement.purpose,
    jurisdiction: entitlement.jurisdiction,
    geographicScope: entitlement.geographicScope,
    restrictions: entitlement.restrictions,
    provenance: entitlement.provenance,
    transferability: entitlement.transferability,
    replenishesAt: nextReplenishmentAt(entitlement.replenishment.kind, input.evaluatedAt, entitlement.replenishment),
    policyRef: policy?.policyRef ?? null,
  });
}

export class AccessEntitlementEngine {
  /**
   * Computes remaining requestable access eligibility. Does not execute reservations.
   */
  evaluate(input: AccessEntitlementEngineInput): Result<AccessEntitlementEngineResult, AccessFabricFailure> {
    const scanned = scanForbiddenAccessPayload(input);
    if (!scanned.ok) {
      return scanned;
    }

    const policyById = policyDecisionIndex(input.policyEligibility);
    const eligibleRequests: EligibleAccessRequest[] = [];
    const excluded: AccessEntitlementEngineResult['excluded'][number][] = [];

    for (const entitlement of input.entitlements) {
      if (entitlement.subjectId !== input.subjectId) {
        continue;
      }
      const evaluated = evaluateEntitlement(entitlement, input, policyById);
      if (!evaluated.ok) {
        excluded.push({
          entitlementId: entitlement.entitlementId,
          code: evaluated.error.code,
          message: evaluated.error.message,
        });
        continue;
      }
      if (evaluated.value) {
        eligibleRequests.push(evaluated.value);
      }
    }

    const envelope: PersonalAccessEnvelope = {
      envelopeId: newPersonalAccessEnvelopeId(),
      subjectId: input.subjectId,
      evaluatedAt: input.evaluatedAt,
      humanWorthScore: false,
      eligibleRequests: Object.freeze(eligibleRequests),
    };

    return ok({ envelope, excluded: Object.freeze(excluded) });
  }
}

export function buildPersonalAccessEnvelope(
  input: AccessEntitlementEngineInput,
): Result<PersonalAccessEnvelope, AccessFabricFailure> {
  const engine = new AccessEntitlementEngine();
  const result = engine.evaluate(input);
  if (!result.ok) {
    return result;
  }
  return ok(result.value.envelope);
}

export function transferAllowed(entitlement: AccessEntitlement): Result<true, AccessFabricFailure> {
  if (!entitlement.transferability) {
    return err(failure('TRANSFER_FORBIDDEN', 'entitlement transferability defaults to false unless explicitly permitted'));
  }
  return ok(true);
}
