import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { asUtcInstant } from '../../domain/src/time.ts';
import {
  AccessEntitlementEngine,
  accessFabricIsNotHumanWorthScoring,
  buildPersonalAccessEnvelope,
  scanForbiddenAccessPayload,
  transferAllowed,
} from './index.ts';
import { newAccessEntitlementId, newAccessReservationId, newAccessUsageEventId } from './ids.ts';
import type {
  AccessEntitlement,
  AccessEntitlementEngineInput,
  AccessMandateConstraint,
  AccessPolicyEligibilityDecision,
  AccessReservation,
  AccessUsageRecord,
  JurisdictionCapability,
} from './types.ts';

const SUBJECT = 'subj_access_test';
const NOW = asUtcInstant('2026-08-29T12:00:00.000Z');

function baseEntitlement(overrides: Partial<AccessEntitlement> = {}): AccessEntitlement {
  return {
    entitlementId: newAccessEntitlementId(),
    subjectId: SUBJECT,
    category: 'LIBRARY_VISIT',
    capacity: 5n,
    startAt: asUtcInstant('2026-01-01T00:00:00.000Z'),
    endAt: asUtcInstant('2027-01-01T00:00:00.000Z'),
    jurisdiction: 'US-NY',
    geographicScope: 'US-NY',
    purpose: 'COMMUNITY_ACCESS',
    restrictions: Object.freeze([
      { kind: 'TIME_WINDOW', code: 'WEEKDAY_ONLY', description: 'Monday through Friday only' },
    ]),
    expiry: asUtcInstant('2027-01-01T00:00:00.000Z'),
    replenishment: {
      kind: 'MONTHLY',
      windowStartAt: asUtcInstant('2026-08-01T00:00:00.000Z'),
      windowEndAt: asUtcInstant('2026-09-01T00:00:00.000Z'),
      quantityPerWindow: 5n,
    },
    provenance: 'COMMUNITY',
    transferability: false,
    humanWorthScore: false,
    isMonetaryAsset: false,
    isTransferableBalance: false,
    ...overrides,
  };
}

function policyAllow(entitlement: AccessEntitlement): AccessPolicyEligibilityDecision {
  return {
    entitlementId: entitlement.entitlementId,
    eligible: true,
    policyRef: 'rdt.simulation.community-access.v1',
    evaluatedAt: NOW,
    reasonCode: 'POLICY_ALLOW',
  };
}

function policyDeny(entitlement: AccessEntitlement): AccessPolicyEligibilityDecision {
  return {
    entitlementId: entitlement.entitlementId,
    eligible: false,
    policyRef: 'rdt.simulation.community-access.v1',
    evaluatedAt: NOW,
    reasonCode: 'POLICY_DENY',
  };
}

const jurisdictionCapability: JurisdictionCapability = {
  actorJurisdiction: 'US-NY',
  permittedJurisdictions: ['US-NY'],
  geographicScopes: ['US-NY'],
};

function engineInput(
  entitlement: AccessEntitlement,
  overrides: Partial<AccessEntitlementEngineInput> = {},
): AccessEntitlementEngineInput {
  return {
    subjectId: SUBJECT,
    evaluatedAt: NOW,
    entitlements: [entitlement],
    mandates: [],
    policyEligibility: [policyAllow(entitlement)],
    usage: [],
    reservations: [],
    jurisdictionCapability,
    ...overrides,
  };
}

describe('Access Entitlement Engine — ACCESS-04', () => {
  it('preserves humanWorthScore=false and rejects human-worth scoring fields', () => {
    assert.equal(accessFabricIsNotHumanWorthScoring(), false);
    const entitlement = baseEntitlement();
    const result = buildPersonalAccessEnvelope(engineInput(entitlement));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.humanWorthScore, false);
    }
    const forbidden = scanForbiddenAccessPayload({ humanWorthScore: 99 });
    assert.equal(forbidden.ok, false);
    if (!forbidden.ok) {
      assert.equal(forbidden.error.code, 'HUMAN_WORTH_SCORE_FORBIDDEN');
    }
    const reputation = scanForbiddenAccessPayload({ socialCreditScore: 1 });
    assert.equal(reputation.ok, false);
    const credit = scanForbiddenAccessPayload({ creditScore: 720 });
    assert.equal(credit.ok, false);
  });

  it('rejects unauthorized sensitive-data dependence', () => {
    const rawPdv = scanForbiddenAccessPayload({ rawPdvContent: 'secret row' });
    assert.equal(rawPdv.ok, false);
    if (!rawPdv.ok) {
      assert.equal(rawPdv.error.code, 'RAW_PDV_CONTENT_FORBIDDEN');
    }
    const bureau = scanForbiddenAccessPayload({ creditBureauRaw: { score: 700 } });
    assert.equal(bureau.ok, false);
    if (!bureau.ok) {
      assert.equal(bureau.error.code, 'SENSITIVE_DATA_DEPENDENCE_FORBIDDEN');
    }
  });

  it('enforces expiry and end dates', () => {
    const expired = baseEntitlement({ expiry: asUtcInstant('2026-08-01T00:00:00.000Z') });
    const result = buildPersonalAccessEnvelope(engineInput(expired));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.eligibleRequests.length, 0);
    }
    const notStarted = baseEntitlement({ startAt: asUtcInstant('2026-12-01T00:00:00.000Z') });
    const pending = buildPersonalAccessEnvelope(engineInput(notStarted));
    assert.equal(pending.ok, true);
    if (pending.ok) {
      assert.equal(pending.value.eligibleRequests.length, 0);
    }
  });

  it('enforces capacity caps with usage and reservations', () => {
    const entitlement = baseEntitlement();
    const usage: AccessUsageRecord[] = [
      {
        eventId: newAccessUsageEventId(),
        entitlementId: entitlement.entitlementId,
        subjectId: SUBJECT,
        quantity: 3n,
        consumedAt: asUtcInstant('2026-08-15T10:00:00.000Z'),
        purpose: 'COMMUNITY_ACCESS',
        idempotent: true,
      },
    ];
    const reservations: AccessReservation[] = [
      {
        reservationId: newAccessReservationId(),
        entitlementId: entitlement.entitlementId,
        subjectId: SUBJECT,
        quantity: 1n,
        reservedAt: asUtcInstant('2026-08-29T11:00:00.000Z'),
        expiresAt: asUtcInstant('2026-08-29T18:00:00.000Z'),
        purpose: 'COMMUNITY_ACCESS',
        executed: false,
      },
    ];
    const result = buildPersonalAccessEnvelope(engineInput(entitlement, { usage, reservations }));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.eligibleRequests.length, 1);
      assert.equal(result.value.eligibleRequests[0]?.remainingCapacity, 1n);
    }
  });

  it('enforces jurisdiction restrictions', () => {
    const entitlement = baseEntitlement({ jurisdiction: 'GB-ENG', geographicScope: 'GB-ENG' });
    const result = buildPersonalAccessEnvelope(
      engineInput(entitlement, {
        jurisdictionCapability: {
          actorJurisdiction: 'US-NY',
          permittedJurisdictions: ['US-NY'],
          geographicScopes: ['US-NY'],
        },
      }),
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.eligibleRequests.length, 0);
    }
  });

  it('defaults transferability to false and refuses transfers unless explicitly permitted', () => {
    const nonTransferable = baseEntitlement({ transferability: false });
    assert.equal(nonTransferable.transferability, false);
    const refused = transferAllowed(nonTransferable);
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.error.code, 'TRANSFER_FORBIDDEN');
    }
    const transferable = baseEntitlement({ transferability: true, provenance: 'PURCHASED' });
    const allowed = transferAllowed(transferable);
    assert.equal(allowed.ok, true);
  });

  it('applies deterministic monthly replenishment windows', () => {
    const entitlement = baseEntitlement({
      replenishment: {
        kind: 'MONTHLY',
        windowStartAt: asUtcInstant('2026-08-01T00:00:00.000Z'),
        windowEndAt: asUtcInstant('2026-09-01T00:00:00.000Z'),
        quantityPerWindow: 4n,
      },
    });
    const priorMonthUsage: AccessUsageRecord[] = [
      {
        eventId: newAccessUsageEventId(),
        entitlementId: entitlement.entitlementId,
        subjectId: SUBJECT,
        quantity: 4n,
        consumedAt: asUtcInstant('2026-07-20T10:00:00.000Z'),
        purpose: 'COMMUNITY_ACCESS',
        idempotent: true,
      },
    ];
    const result = buildPersonalAccessEnvelope(engineInput(entitlement, { usage: priorMonthUsage }));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.eligibleRequests[0]?.remainingCapacity, 4n);
      assert.equal(result.value.eligibleRequests[0]?.replenishesAt, '2026-09-01T00:00:00.000Z');
    }
    const engine = new AccessEntitlementEngine();
    const repeat = engine.evaluate(engineInput(entitlement, { usage: priorMonthUsage }));
    assert.equal(repeat.ok, true);
    if (repeat.ok && result.ok) {
      assert.equal(
        repeat.value.envelope.eligibleRequests[0]?.remainingCapacity,
        result.value.eligibleRequests[0]?.remainingCapacity,
      );
    }
  });

  it('deduplicates usage events for idempotency', () => {
    const entitlement = baseEntitlement();
    const eventId = newAccessUsageEventId();
    const usage: AccessUsageRecord[] = [
      {
        eventId,
        entitlementId: entitlement.entitlementId,
        subjectId: SUBJECT,
        quantity: 2n,
        consumedAt: asUtcInstant('2026-08-10T10:00:00.000Z'),
        purpose: 'COMMUNITY_ACCESS',
        idempotent: true,
      },
      {
        eventId,
        entitlementId: entitlement.entitlementId,
        subjectId: SUBJECT,
        quantity: 2n,
        consumedAt: asUtcInstant('2026-08-10T10:00:00.000Z'),
        purpose: 'COMMUNITY_ACCESS',
        idempotent: true,
      },
    ];
    const result = buildPersonalAccessEnvelope(engineInput(entitlement, { usage }));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.eligibleRequests[0]?.remainingCapacity, 3n);
    }
  });

  it('narrows eligibility through mandates without expanding authority', () => {
    const entitlement = baseEntitlement({ category: 'MUSEUM_ENTRY', purpose: 'CULTURE' });
    const mandates: AccessMandateConstraint[] = [
      {
        mandateId: 'mandate_narrow_1',
        allowedCategories: ['MUSEUM_ENTRY'],
        allowedPurposes: ['CULTURE'],
        maxQuantityPerRequest: 2n,
      },
    ];
    const allowed = buildPersonalAccessEnvelope(
      engineInput(entitlement, { mandates, policyEligibility: [policyAllow(entitlement)] }),
    );
    assert.equal(allowed.ok, true);
    if (allowed.ok) {
      assert.equal(allowed.value.eligibleRequests[0]?.remainingCapacity, 2n);
    }
    const blocked = buildPersonalAccessEnvelope(
      engineInput(entitlement, {
        mandates: [{ mandateId: 'mandate_block', allowedCategories: ['TRANSIT_PASS'] }],
      }),
    );
    assert.equal(blocked.ok, true);
    if (blocked.ok) {
      assert.equal(blocked.value.eligibleRequests.length, 0);
    }
  });

  it('consumes policy eligibility from an external port rather than embedding legal rules', () => {
    const entitlement = baseEntitlement();
    const denied = buildPersonalAccessEnvelope(
      engineInput(entitlement, { policyEligibility: [policyDeny(entitlement)] }),
    );
    assert.equal(denied.ok, true);
    if (denied.ok) {
      assert.equal(denied.value.eligibleRequests.length, 0);
    }
    const allowed = buildPersonalAccessEnvelope(
      engineInput(entitlement, { policyEligibility: [policyAllow(entitlement)] }),
    );
    assert.equal(allowed.ok, true);
    if (allowed.ok) {
      assert.equal(allowed.value.eligibleRequests.length, 1);
      assert.equal(allowed.value.eligibleRequests[0]?.policyRef, 'rdt.simulation.community-access.v1');
    }
  });

  it('does not execute reservations — only subtracts active holds from remaining capacity', () => {
    const entitlement = baseEntitlement();
    const reservations: AccessReservation[] = [
      {
        reservationId: newAccessReservationId(),
        entitlementId: entitlement.entitlementId,
        subjectId: SUBJECT,
        quantity: 2n,
        reservedAt: NOW,
        expiresAt: asUtcInstant('2026-08-29T20:00:00.000Z'),
        purpose: 'COMMUNITY_ACCESS',
        executed: false,
      },
    ];
    const engine = new AccessEntitlementEngine();
    const before = engine.evaluate(engineInput(entitlement, { reservations }));
    const after = engine.evaluate(engineInput(entitlement, { reservations }));
    assert.equal(before.ok, true);
    assert.equal(after.ok, true);
    if (before.ok && after.ok) {
      assert.equal(before.value.envelope.eligibleRequests[0]?.remainingCapacity, 3n);
      assert.deepEqual(
        before.value.envelope.eligibleRequests,
        after.value.envelope.eligibleRequests,
      );
      assert.equal(reservations[0]?.executed, false);
    }
  });

  it('supports configurable provenance sources without implying government provision', () => {
    const sources = [
      'BASELINE',
      'PUBLIC_BENEFIT',
      'EMPLOYER',
      'COMMUNITY',
      'PURCHASED',
      'REWARD',
      'MEMBERSHIP',
      'PROMOTION',
      'ROLLOVER',
    ] as const;
    for (const provenance of sources) {
      const entitlement = baseEntitlement({ provenance });
      const result = buildPersonalAccessEnvelope(engineInput(entitlement));
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.value.eligibleRequests[0]?.provenance, provenance);
      }
    }
  });
});
