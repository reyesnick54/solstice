import type { UtcInstant } from '../../domain/src/time.ts';
import { classified } from './facts.ts';
import { asRegulatoryScenarioId, asRegulatoryScenarioSuiteId } from './ids.ts';
import type { RegulatoryScenario, RegulatoryScenarioSuite } from './types.ts';

const US = {
  jurisdiction: classified('US', 'SYNTHETIC_FACT' as const),
  actorId: classified('rdt_batch_actor', 'SYNTHETIC_FACT' as const),
  customerStatus: classified('ACTIVE', 'SYNTHETIC_FACT' as const),
  kycState: classified('VERIFIED', 'SYNTHETIC_FACT' as const),
  productId: classified('prod_demand_usd_us', 'SYNTHETIC_FACT' as const),
  legalEntityId: classified('le_solstice_us_inc', 'SYNTHETIC_FACT' as const),
};

/**
 * Deterministic 100-scenario fixture:
 * 90 unchanged OPEN_ACCOUNT (kyc v2)
 * 5 new review OPEN_ACCOUNT (kyc v1)
 * 3 new block INITIATE_PAYMENT (HIGH_RISK beneficiary)
 * 2 insufficient facts (no customer / jurisdiction)
 */
export function batchImpactFixture(at: UtcInstant): {
  readonly suite: RegulatoryScenarioSuite;
  readonly scenarios: readonly RegulatoryScenario[];
} {
  const scenarios: RegulatoryScenario[] = [];
  for (let i = 0; i < 90; i += 1) {
    scenarios.push(
      Object.freeze({
        scenarioId: asRegulatoryScenarioId(`rsc_batch_unchanged_${String(i).padStart(3, '0')}`),
        name: `unchanged-${i}`,
        category: 'US_RETAIL_ACCOUNT',
        createdAt: at,
        facts: {
          ...US,
          customerId: classified(`cus_rdt_batch_u_${i}`, 'SYNTHETIC_FACT'),
          kycRecordVersion: classified(2, 'SYNTHETIC_FACT'),
          actionType: classified('OPEN_ACCOUNT', 'SYNTHETIC_FACT'),
        },
        hypotheticalOverrides: Object.freeze([]),
        invariant: false,
      }),
    );
  }
  for (let i = 0; i < 5; i += 1) {
    scenarios.push(
      Object.freeze({
        scenarioId: asRegulatoryScenarioId(`rsc_batch_review_${String(i).padStart(3, '0')}`),
        name: `new-review-${i}`,
        category: 'US_RETAIL_ACCOUNT',
        createdAt: at,
        facts: {
          ...US,
          customerId: classified(`cus_rdt_batch_r_${i}`, 'SYNTHETIC_FACT'),
          kycRecordVersion: classified(1, 'SYNTHETIC_FACT'),
          actionType: classified('OPEN_ACCOUNT', 'SYNTHETIC_FACT'),
        },
        hypotheticalOverrides: Object.freeze([]),
        invariant: false,
      }),
    );
  }
  for (let i = 0; i < 3; i += 1) {
    scenarios.push(
      Object.freeze({
        scenarioId: asRegulatoryScenarioId(`rsc_batch_block_${String(i).padStart(3, '0')}`),
        name: `new-block-${i}`,
        category: 'US_SA_CROSS_BORDER',
        createdAt: at,
        facts: {
          ...US,
          customerId: classified(`cus_rdt_batch_b_${i}`, 'SYNTHETIC_FACT'),
          kycRecordVersion: classified(2, 'SYNTHETIC_FACT'),
          actionType: classified('INITIATE_PAYMENT', 'SYNTHETIC_FACT'),
          corridorId: classified('US-SA-USD-SAR', 'SYNTHETIC_FACT'),
          corridorSimulationEnabled: classified(true, 'SYNTHETIC_FACT'),
          sanctionsHit: classified(false, 'SYNTHETIC_FACT'),
          pepHit: classified(false, 'SYNTHETIC_FACT'),
          fraudHold: classified(false, 'SYNTHETIC_FACT'),
          beneficiaryStatus: classified('HIGH_RISK', 'SYNTHETIC_FACT'),
          currency: classified('USD', 'SYNTHETIC_FACT'),
          amountMinorUnits: classified('10000', 'SYNTHETIC_FACT'),
        },
        hypotheticalOverrides: Object.freeze([]),
        invariant: false,
      }),
    );
  }
  for (let i = 0; i < 2; i += 1) {
    scenarios.push(
      Object.freeze({
        scenarioId: asRegulatoryScenarioId(`rsc_batch_missing_${String(i).padStart(3, '0')}`),
        name: `insufficient-${i}`,
        category: 'US_RETAIL_ACCOUNT',
        createdAt: at,
        facts: {
          actorId: classified('rdt_batch_actor', 'SYNTHETIC_FACT'),
          actionType: classified('OPEN_ACCOUNT', 'SYNTHETIC_FACT'),
        },
        hypotheticalOverrides: Object.freeze([]),
        invariant: false,
      }),
    );
  }
  return Object.freeze({
    suite: Object.freeze({
      suiteId: asRegulatoryScenarioSuiteId('rss_batch_impact_100'),
      name: 'deterministic batch impact 100',
      category: 'US_RETAIL_ACCOUNT',
      scenarioIds: Object.freeze(scenarios.map((row) => row.scenarioId)),
      invariant: false,
      createdAt: at,
    }),
    scenarios: Object.freeze(scenarios),
  });
}

export const EXPECTED_BATCH_COUNTS = Object.freeze({
  totalEvaluated: 100,
  unchanged: 90,
  newReview: 5,
  newBlock: 3,
  newDefer: 0,
  newAllow: 0,
  insufficientFacts: 2,
});
