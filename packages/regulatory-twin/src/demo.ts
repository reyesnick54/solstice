import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { isOk } from '../../domain/src/result.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { createSimulationPolicyEngine } from '../../kernel/src/policy/index.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { candidateUsBatchImpact, candidateUsCorridorEnhancedScreening, candidateUsOpenAccountReview } from './candidates.ts';
import { classified } from './facts.ts';
import { batchImpactFixture, EXPECTED_BATCH_COUNTS } from './fixtures.ts';
import { asRegulatoryScenarioId } from './ids.ts';
import { RegulatoryDigitalTwin } from './service.ts';
import { builtInSuites } from './suites.ts';
import type { RegulatoryScenario } from './types.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

function requireOk<T>(result: { ok: boolean; value?: T; error?: unknown }, label: string): T {
  if (!result.ok || result.value === undefined) {
    throw new Error(`${label} failed: ${JSON.stringify(result)}`);
  }
  return result.value;
}

async function main(): Promise<void> {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events, evidence });
  const provisioned = identity.provisionSimulatedActor({
    actorId: 'actor_rdt_operator',
    jurisdiction: asJurisdiction('US'),
    identityId: 'id_rdt_operator',
    customerId: asCustomerId('cust_rdt_operator'),
    capabilities: [
      'VIEW_REGULATORY_TWIN',
      'OPERATE_REGULATORY_TWIN',
      'RUN_HISTORICAL_CUSTOMER_SCENARIO',
    ],
  });
  if (!isOk(provisioned)) {
    throw new Error('operator provision failed');
  }
  const actor = provisioned.value;
  const engine = createSimulationPolicyEngine();
  const twin = new RegulatoryDigitalTwin({
    clock,
    evidence,
    events,
    productionRegistry: engine.registry,
  });
  const snapshot = requireOk(twin.captureSnapshot(actor), 'snapshot');
  const us = engine.registry.listVersions('US').find((row) => row.versionId === 'us-sim-v1');
  if (!us) {
    throw new Error('US v1 missing');
  }

  console.log('=== Regulatory Digital Twin demonstration ===');
  console.log('ENVIRONMENT=simulation. RDT never issues Execution Authority or posts journals.');

  const openScenario: RegulatoryScenario = {
    scenarioId: asRegulatoryScenarioId('rsc_demo_open_v1'),
    name: 'US verified OPEN_ACCOUNT',
    category: 'US_RETAIL_ACCOUNT',
    createdAt: NOW,
    facts: {
      jurisdiction: classified('US', 'SYNTHETIC_FACT'),
      actorId: classified('rdt_demo_actor', 'SYNTHETIC_FACT'),
      customerId: classified('cus_rdt_demo_us', 'SYNTHETIC_FACT'),
      customerStatus: classified('ACTIVE', 'SYNTHETIC_FACT'),
      kycState: classified('VERIFIED', 'SYNTHETIC_FACT'),
      kycRecordVersion: classified(1, 'SYNTHETIC_FACT'),
      productId: classified('prod_demand_usd_us', 'SYNTHETIC_FACT'),
      legalEntityId: classified('le_solstice_us_inc', 'SYNTHETIC_FACT'),
      actionType: classified('OPEN_ACCOUNT', 'SYNTHETIC_FACT'),
    },
    hypotheticalOverrides: Object.freeze([]),
    invariant: false,
  };
  requireOk(twin.createScenario(actor, openScenario), 'create open scenario');
  const v2 = candidateUsOpenAccountReview(us);
  const candidate = requireOk(
    twin.registerCandidateSet(actor, {
      label: 'US V2 KYC refresh review',
      createdAt: NOW,
      versions: [v2],
      sourceRefs: ['src-engineering-pack-shell'],
      legalReviewStatus: 'RESEARCH_REQUIRED',
      notes: 'Engineering candidate. Not counsel-confirmed.',
    }),
    'candidate v2',
  );
  const demo1 = requireOk(
    twin.compare(actor, {
      scenario: openScenario,
      candidateVersions: [v2],
      baselineSnapshotId: snapshot.snapshotId,
      candidateSetId: candidate.candidateSetId,
    }),
    'demo1',
  );
  console.log('\n--- Demo 1: policy change ---');
  console.log(`current: ${demo1.current.decision}`);
  console.log(`candidate: ${demo1.candidate.decision}`);
  console.log(`transition: ${demo1.transition}`);
  console.log(`rule causing change: ${demo1.reasonCodeDiff.added.join(', ')}`);
  console.log(`legal confidence: ${demo1.candidate.legalConfidence}`);
  console.log(`execution authority issued: ${demo1.candidate.executionAuthorityIssued}`);
  console.log(`account opened: false`);

  const corridorScenario: RegulatoryScenario = {
    scenarioId: asRegulatoryScenarioId('rsc_demo_corridor'),
    name: 'US→SA payment',
    category: 'US_SA_CROSS_BORDER',
    createdAt: NOW,
    facts: {
      jurisdiction: classified('US', 'SYNTHETIC_FACT'),
      actorId: classified('rdt_demo_actor', 'SYNTHETIC_FACT'),
      customerId: classified('cus_rdt_demo_corridor', 'SYNTHETIC_FACT'),
      customerStatus: classified('ACTIVE', 'SYNTHETIC_FACT'),
      kycState: classified('VERIFIED', 'SYNTHETIC_FACT'),
      kycRecordVersion: classified(2, 'SYNTHETIC_FACT'),
      productId: classified('prod_demand_usd_us', 'SYNTHETIC_FACT'),
      legalEntityId: classified('le_solstice_us_inc', 'SYNTHETIC_FACT'),
      actionType: classified('INITIATE_PAYMENT', 'SYNTHETIC_FACT'),
      corridorId: classified('US-SA-USD-SAR', 'SYNTHETIC_FACT'),
      corridorSimulationEnabled: classified(true, 'SYNTHETIC_FACT'),
      sanctionsHit: classified(false, 'SYNTHETIC_FACT'),
      pepHit: classified(false, 'SYNTHETIC_FACT'),
      fraudHold: classified(false, 'SYNTHETIC_FACT'),
      currency: classified('USD', 'SYNTHETIC_FACT'),
      amountMinorUnits: classified('25000', 'SYNTHETIC_FACT'),
    },
    hypotheticalOverrides: Object.freeze([]),
    invariant: false,
  };
  const corridorPack = candidateUsCorridorEnhancedScreening(us);
  const demo2 = requireOk(
    twin.compare(actor, {
      scenario: corridorScenario,
      candidateVersions: [corridorPack],
      baselineSnapshotId: snapshot.snapshotId,
      candidateSetId: candidate.candidateSetId,
    }),
    'demo2',
  );
  console.log('\n--- Demo 2: US→SA corridor ---');
  console.log(`current: ${demo2.current.decision}`);
  console.log(`candidate: ${demo2.candidate.decision} (${demo2.candidate.decisionClass})`);
  console.log(`missing requirement: ${demo2.candidate.reasonCodes.join(', ')}`);
  console.log('payment submitted: false');
  console.log('liquidity reserved: false');
  console.log(`execution authority issued: ${demo2.candidate.executionAuthorityIssued}`);

  const batch = batchImpactFixture(NOW);
  const batchCandidate = candidateUsBatchImpact(us);
  const batchSet = requireOk(
    twin.registerCandidateSet(actor, {
      label: 'US V2 batch impact',
      createdAt: NOW,
      versions: [batchCandidate],
      sourceRefs: ['src-engineering-pack-shell'],
      legalReviewStatus: 'RESEARCH_REQUIRED',
      notes: 'Deterministic 100-scenario fixture',
    }),
    'batch candidate',
  );
  const demo3 = requireOk(
    twin.runBatch(actor, {
      scenarios: batch.scenarios,
      candidateVersions: [batchCandidate],
      baselineSnapshotId: snapshot.snapshotId,
      candidateSetId: batchSet.candidateSetId,
      suiteId: batch.suite.suiteId,
    }),
    'demo3',
  );
  console.log('\n--- Demo 3: batch impact ---');
  console.log(JSON.stringify(demo3.counts, null, 2));
  if (JSON.stringify(demo3.counts) !== JSON.stringify(EXPECTED_BATCH_COUNTS)) {
    throw new Error(`batch counts drifted: ${JSON.stringify(demo3.counts)}`);
  }

  const suites = builtInSuites(NOW);
  const invariants = requireOk(
    twin.runInvariants(actor, {
      scenarios: suites.scenarios.filter((row) => row.invariant),
      candidateVersions: [v2],
      baselineSnapshotId: snapshot.snapshotId,
      candidateSetId: candidate.candidateSetId,
    }),
    'invariants',
  );
  const report = requireOk(
    twin.generateImpactReport(actor, {
      baseline: snapshot,
      candidateSet: candidate,
      suiteId: batch.suite.suiteId,
      batch: demo3,
      invariantFailures: invariants.failures,
      assumptionIds: [],
    }),
    'report',
  );
  console.log('\n--- Impact report ---');
  console.log(`report ${report.reportId}`);
  console.log(`decision changes: ${report.decisionChanges}`);
  console.log(`new reviews: ${report.newReviews} new blocks: ${report.newBlocks}`);
  console.log(`candidate simulation-ready: ${report.candidateSimulationReady}`);
  console.log(`activation refused: ${twin.activateCandidatePolicy().code}`);
  console.log(`evidence records: ${evidence.list().length}`);
  console.log(`events: ${events.list().map((row) => row.eventType).join(', ')}`);
  console.log('\nRegulatory Digital Twin demo: ok');
}

await main();
