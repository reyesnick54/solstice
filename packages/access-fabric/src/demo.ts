import { asUtcInstant } from '../../domain/src/time.ts';
import { newAccessEntitlementId } from './ids.ts';
import { AccessEntitlementEngine } from './engine.ts';
import type {
  AccessEntitlement,
  AccessEntitlementEngineInput,
  AccessMandateConstraint,
  AccessPolicyEligibilityDecision,
  AccessReservation,
  AccessUsageRecord,
  JurisdictionCapability,
} from './types.ts';

const SUBJECT = 'subj_demo_access';
const NOW = asUtcInstant('2026-08-29T12:00:00.000Z');

function entitlement(overrides: Partial<AccessEntitlement> = {}): AccessEntitlement {
  return {
    entitlementId: newAccessEntitlementId(),
    subjectId: SUBJECT,
    category: 'TRANSIT_PASS',
    capacity: 10n,
    startAt: asUtcInstant('2026-01-01T00:00:00.000Z'),
    endAt: asUtcInstant('2027-01-01T00:00:00.000Z'),
    jurisdiction: 'US-CA',
    geographicScope: 'US-CA',
    purpose: 'PUBLIC_TRANSIT',
    restrictions: Object.freeze([]),
    expiry: asUtcInstant('2027-01-01T00:00:00.000Z'),
    replenishment: {
      kind: 'MONTHLY',
      windowStartAt: asUtcInstant('2026-08-01T00:00:00.000Z'),
      windowEndAt: asUtcInstant('2026-09-01T00:00:00.000Z'),
      quantityPerWindow: 10n,
    },
    provenance: 'EMPLOYER',
    transferability: false,
    humanWorthScore: false,
    isMonetaryAsset: false,
    isTransferableBalance: false,
    ...overrides,
  };
}

const jurisdictionCapability: JurisdictionCapability = {
  actorJurisdiction: 'US-CA',
  permittedJurisdictions: ['US-CA'],
  geographicScopes: ['US-CA'],
};

function policyDecision(entitlementId: AccessEntitlement['entitlementId']): AccessPolicyEligibilityDecision {
  return {
    entitlementId,
    eligible: true,
    policyRef: 'rdt.simulation.access-transit.v1',
    evaluatedAt: NOW,
    reasonCode: 'POLICY_ALLOW',
  };
}

function run(input: Partial<AccessEntitlementEngineInput>): void {
  const baseEntitlement = entitlement();
  const engine = new AccessEntitlementEngine();
  const result = engine.evaluate({
    subjectId: SUBJECT,
    evaluatedAt: NOW,
    entitlements: [baseEntitlement],
    mandates: [],
    policyEligibility: [policyDecision(baseEntitlement.entitlementId)],
    usage: [],
    reservations: [],
    jurisdictionCapability,
    ...input,
  });
  if (!result.ok) {
    console.error(result.error);
    process.exitCode = 1;
    return;
  }
  console.log(
    JSON.stringify(
      {
        subjectId: result.value.envelope.subjectId,
        humanWorthScore: result.value.envelope.humanWorthScore,
        eligibleCount: result.value.envelope.eligibleRequests.length,
        categories: result.value.envelope.eligibleRequests.map((item) => item.category),
      },
      (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
      2,
    ),
  );
}

run({});
