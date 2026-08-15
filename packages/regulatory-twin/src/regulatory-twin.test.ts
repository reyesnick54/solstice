import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
import { changeAssumptionStatus, createAssumption } from './assumptions.ts';
import {
  candidateUsBatchImpact,
  candidateUsCorridorEnhancedScreening,
  candidateUsFutureEffective,
  candidateUsOpenAccountReview,
  candidateUsSanctionsWeakened,
} from './candidates.ts';
import { compareCurrentVsCandidate, replayHistorical } from './compare.ts';
import { classified, hypotheticalFactKeys, opaqueSubjectRefFor } from './facts.ts';
import { EXPECTED_BATCH_COUNTS, batchImpactFixture } from './fixtures.ts';
import { assessGrowthPlanImpact, estimatePeveImpact } from './growth.ts';
import { asCandidatePolicySetId, asRegulatoryScenarioId } from './ids.ts';
import { runInvariantSuite } from './invariants.ts';
import {
  assessCardReadiness,
  assessCorridorReadiness,
  assessInvestmentReadiness,
  assessProductReadiness,
} from './readiness.ts';
import { refuseAiLegalStatus } from './access.ts';
import { RegulatoryDigitalTwin } from './service.ts';
import { captureRegulatorySnapshot } from './snapshot.ts';
import { builtInSuites } from './suites.ts';
import type { RegulatoryScenario } from './types.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');
const FUTURE = asUtcInstant('2027-01-01T00:00:00.000Z');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function world() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events, evidence });
  const operator = identity.provisionSimulatedActor({
    actorId: 'actor_rdt_op',
    jurisdiction: asJurisdiction('US'),
    identityId: 'id_rdt_op',
    customerId: asCustomerId('cust_rdt_op'),
    capabilities: [
      'VIEW_REGULATORY_TWIN',
      'OPERATE_REGULATORY_TWIN',
      'RUN_HISTORICAL_CUSTOMER_SCENARIO',
    ],
  });
  assert.equal(operator.ok, true);
  if (!operator.ok) throw new Error('operator');
  const viewer = identity.provisionSimulatedActor({
    actorId: 'actor_rdt_view',
    jurisdiction: asJurisdiction('US'),
    identityId: 'id_rdt_view',
    customerId: asCustomerId('cust_rdt_view'),
    capabilities: ['VIEW_REGULATORY_TWIN'],
  });
  assert.equal(viewer.ok, true);
  if (!viewer.ok) throw new Error('viewer');
  const stranger = identity.provisionSimulatedActor({
    actorId: 'actor_rdt_stranger',
    jurisdiction: asJurisdiction('US'),
    identityId: 'id_rdt_stranger',
    customerId: asCustomerId('cust_rdt_stranger'),
    capabilities: ['VIEW_ACCOUNT'],
  });
  assert.equal(stranger.ok, true);
  if (!stranger.ok) throw new Error('stranger');
  const engine = createSimulationPolicyEngine();
  const twin = new RegulatoryDigitalTwin({
    clock,
    evidence,
    events,
    productionRegistry: engine.registry,
  });
  return { clock, events, evidence, operator: operator.value, viewer: viewer.value, stranger: stranger.value, engine, twin };
}

function usOpen(id: string, kycVersion: number): RegulatoryScenario {
  return {
    scenarioId: asRegulatoryScenarioId(id),
    name: id,
    category: 'US_RETAIL_ACCOUNT',
    createdAt: NOW,
    facts: {
      jurisdiction: classified('US', 'SYNTHETIC_FACT'),
      actorId: classified('rdt_test_actor', 'SYNTHETIC_FACT'),
      customerId: classified('cus_rdt_test_us', 'SYNTHETIC_FACT'),
      customerStatus: classified('ACTIVE', 'SYNTHETIC_FACT'),
      kycState: classified('VERIFIED', 'SYNTHETIC_FACT'),
      kycRecordVersion: classified(kycVersion, 'SYNTHETIC_FACT'),
      productId: classified('prod_demand_usd_us', 'SYNTHETIC_FACT'),
      legalEntityId: classified('le_solstice_us_inc', 'SYNTHETIC_FACT'),
      actionType: classified('OPEN_ACCOUNT', 'SYNTHETIC_FACT'),
    },
    hypotheticalOverrides: Object.freeze([]),
    invariant: false,
  };
}

describe('Regulatory Digital Twin', () => {
  it('reuses the existing policy engine and never issues Execution Authority', () => {
    const { twin, operator, engine } = world();
    const snapshot = twin.captureSnapshot(operator);
    assert.equal(snapshot.ok, true);
    if (!snapshot.ok) throw new Error('snapshot');
    const us = engine.registry.getVersion('us-sim-v1');
    assert.ok(us);
    const candidate = candidateUsOpenAccountReview(us);
    const comparison = twin.compare(operator, {
      scenario: usOpen('rsc_test_open', 1),
      candidateVersions: [candidate],
      baselineSnapshotId: snapshot.value.snapshotId,
      candidateSetId: twin.registerCandidateSet(operator, {
        label: 'v2',
        createdAt: NOW,
        versions: [candidate],
        sourceRefs: ['src-engineering-pack-shell'],
        legalReviewStatus: 'RESEARCH_REQUIRED',
        notes: 'test',
      }).ok
        ? (twin.store.snapshot().candidates[0]?.candidateSetId ??
          (() => {
            throw new Error('candidate');
          })())
        : (() => {
            throw new Error('candidate');
          })(),
    });
    assert.equal(comparison.ok, true);
    if (!comparison.ok) throw new Error('compare');
    assert.equal(comparison.value.current.decision, 'ALLOW');
    assert.equal(comparison.value.candidate.decision, 'REQUIRE_MANUAL_REVIEW');
    assert.equal(comparison.value.transition, 'ALLOW_TO_REVIEW');
    assert.equal(comparison.value.restrictiveness, 'MATERIALLY_MORE_RESTRICTIVE');
    assert.equal(comparison.value.legallyDesirable, null);
    assert.equal(comparison.value.current.executionAuthorityIssued, false);
    assert.equal(comparison.value.candidate.executionAuthorityIssued, false);
    assert.equal(comparison.value.candidate.journalPosted, false);
    assert.ok(comparison.value.reasonCodeDiff.added.includes('CANDIDATE_KYC_REFRESH_REVIEW'));
    assert.equal(engine.registry.getVersion('us-sim-v1')?.lifecycle, 'ACTIVE_SIMULATION');
    assert.equal(engine.registry.getVersion(candidate.versionId), undefined);
  });

  it('marks hypothetical facts and refuses to treat them as customer state', () => {
    const facts = {
      kycState: classified('VERIFIED', 'HYPOTHETICAL_FACT' as const),
      jurisdiction: classified('US', 'SYNTHETIC_FACT' as const),
    };
    assert.deepEqual(hypotheticalFactKeys(facts), ['kycState']);
    const src = readFileSync(join(ROOT, 'packages/regulatory-twin/src/service.ts'), 'utf8');
    assert.equal(/IdentityService|recordKyc|grantCapability/.test(src), false);
  });

  it('fails closed when required facts are missing', () => {
    const { twin } = world();
    const evaluation = twin.evaluateCurrent({
      scenarioId: asRegulatoryScenarioId('rsc_missing_facts'),
      name: 'missing',
      category: 'US_RETAIL_ACCOUNT',
      createdAt: NOW,
      facts: { actionType: classified('OPEN_ACCOUNT', 'SYNTHETIC_FACT') },
      hypotheticalOverrides: Object.freeze([]),
      invariant: false,
    });
    assert.equal(evaluation.decision, 'DEFER');
    assert.equal(evaluation.decisionClass, 'INSUFFICIENT_FACTS');
    assert.ok(evaluation.reasonCodes.includes('REQUIRED_FACT_MISSING'));
  });

  it('reproduces a historical policy pin and does not rewrite evidence', () => {
    const { twin, operator, engine, evidence } = world();
    const before = evidence.list().length;
    const scenario: RegulatoryScenario = {
      ...usOpen('rsc_hist_open', 2),
      historicalPolicyPin: { packId: 'US', versionId: 'us-sim-v1' },
      historicalDecision: 'ALLOW',
      subjectRef: opaqueSubjectRefFor('cus_rdt_hist'),
    };
    const replay = twin.replay(operator, scenario);
    assert.equal(replay.ok, true);
    if (!replay.ok) throw new Error('replay');
    assert.equal(replay.value.reproduced, true);
    assert.equal(replay.value.current.decision, 'ALLOW');
    const direct = replayHistorical({
      productionRegistry: engine.registry,
      scenario,
      at: NOW,
    });
    assert.equal(direct.reproduced, true);
    assert.ok(evidence.list().length >= before);
  });

  it('simulates an explicit future effective date', () => {
    const { engine, twin } = world();
    const us = engine.registry.getVersion('us-sim-v1');
    assert.ok(us);
    const future = candidateUsFutureEffective(us, FUTURE);
    const snapshot = captureRegulatorySnapshot({
      twinId: twin.twin.twinId,
      registry: engine.registry,
      capturedAt: NOW,
      effectiveAt: NOW,
    });
    const candidateSetId = asCandidatePolicySetId('cps_future_effective');
    const today = compareCurrentVsCandidate({
      productionRegistry: engine.registry,
      scenario: usOpen('rsc_future_today', 1),
      candidateVersions: [future],
      baselineSnapshotId: snapshot.snapshotId,
      candidateSetId,
      at: NOW,
    });
    const later = compareCurrentVsCandidate({
      productionRegistry: engine.registry,
      scenario: usOpen('rsc_future_later', 1),
      candidateVersions: [future],
      baselineSnapshotId: snapshot.snapshotId,
      candidateSetId,
      at: FUTURE,
    });
    assert.equal(today.candidate.decision, 'ALLOW');
    assert.equal(later.candidate.decision, 'REQUIRE_MANUAL_REVIEW');
  });

  it('runs the deterministic 100-scenario batch with reproducible counts', () => {
    const { twin, operator, engine } = world();
    const snapshot = twin.captureSnapshot(operator);
    assert.equal(snapshot.ok, true);
    if (!snapshot.ok) throw new Error('snapshot');
    const us = engine.registry.getVersion('us-sim-v1');
    assert.ok(us);
    const candidate = candidateUsBatchImpact(us);
    const set = twin.registerCandidateSet(operator, {
      label: 'batch',
      createdAt: NOW,
      versions: [candidate],
      sourceRefs: ['src-engineering-pack-shell'],
      legalReviewStatus: 'RESEARCH_REQUIRED',
      notes: 'batch',
    });
    assert.equal(set.ok, true);
    if (!set.ok) throw new Error('set');
    const fixture = batchImpactFixture(NOW);
    const first = twin.runBatch(operator, {
      scenarios: fixture.scenarios,
      candidateVersions: [candidate],
      baselineSnapshotId: snapshot.value.snapshotId,
      candidateSetId: set.value.candidateSetId,
      suiteId: fixture.suite.suiteId,
    });
    const second = twin.runBatch(operator, {
      scenarios: fixture.scenarios,
      candidateVersions: [candidate],
      baselineSnapshotId: snapshot.value.snapshotId,
      candidateSetId: set.value.candidateSetId,
      suiteId: fixture.suite.suiteId,
    });
    assert.equal(first.ok && second.ok, true);
    if (!first.ok || !second.ok) throw new Error('batch');
    assert.deepEqual(first.value.counts, EXPECTED_BATCH_COUNTS);
    assert.deepEqual(second.value.counts, EXPECTED_BATCH_COUNTS);
  });

  it('fails invariant suite when a candidate weakens sanctions', () => {
    const { twin, operator, engine } = world();
    const snapshot = twin.captureSnapshot(operator);
    assert.equal(snapshot.ok, true);
    if (!snapshot.ok) throw new Error('snapshot');
    const us = engine.registry.getVersion('us-sim-v1');
    assert.ok(us);
    const weakened = candidateUsSanctionsWeakened(us);
    const set = twin.registerCandidateSet(operator, {
      label: 'weak',
      createdAt: NOW,
      versions: [weakened],
      sourceRefs: ['src-engineering-pack-shell'],
      legalReviewStatus: 'RESEARCH_REQUIRED',
      notes: 'must fail invariants',
    });
    assert.equal(set.ok, true);
    if (!set.ok) throw new Error('set');
    const suites = builtInSuites(NOW);
    const result = runInvariantSuite({
      productionRegistry: engine.registry,
      scenarios: suites.scenarios.filter((row) => row.invariant),
      candidateVersions: [weakened],
      baselineSnapshotId: snapshot.value.snapshotId,
      candidateSetId: set.value.candidateSetId,
      at: NOW,
    });
    assert.equal(result.passed, false);
    assert.equal(result.candidateSimulationReady, false);
    assert.ok(result.failures.some((row) => row.scenarioId === 'rsc_inv_sanctions_block'));
  });

  it('assesses product, corridor, card, and investment readiness without legal approval', () => {
    const { twin, operator, engine } = world();
    const product = twin.assessProduct(operator, {
      registry: engine.registry,
      productId: 'prod_demand_usd_us',
      legalEntityId: 'le_solstice_us_inc',
      jurisdiction: 'US',
      actionType: 'OPEN_ACCOUNT',
      at: NOW,
    });
    assert.equal(product.ok, true);
    if (!product.ok) throw new Error('product');
    assert.notEqual(product.value.state, 'DEPENDENCY_NOT_IMPLEMENTED');
    assert.equal(product.value.liveActivationPermitted, false);
    assert.equal(product.value.legalReviewStatus, 'RESEARCH_REQUIRED');
    const sa = assessProductReadiness({
      registry: engine.registry,
      productId: 'prod_demand_sar_sa',
      legalEntityId: 'le_solstice_sa_entity',
      jurisdiction: 'SA',
      actionType: 'OPEN_ACCOUNT',
      at: NOW,
    });
    assert.equal(sa.state, 'NOT_SUPPORTED');
    const corridor = assessCorridorReadiness({
      registry: engine.registry,
      corridorId: 'US-SA-USD-SAR',
      sourceCountry: 'US',
      destinationCountry: 'SA',
      sourceCurrency: 'USD',
      destinationCurrency: 'SAR',
      legalEntityId: 'le_solstice_us_inc',
      simulationEnabled: true,
      treasuryRouteKnown: true,
      at: NOW,
    });
    assert.equal(corridor.state, 'COUNSEL_REVIEW_REQUIRED');
    assert.equal(corridor.liveActivationPermitted, false);
    const card = assessCardReadiness({
      kind: 'WALLET',
      programId: 'SIMULATION_US_VIRTUAL_PROGRAM',
      legalEntityId: 'le_solstice_us_inc',
      jurisdiction: 'US',
      simulationEnabled: true,
      at: NOW,
    });
    assert.equal(card.state, 'RESEARCH_REQUIRED');
    assert.ok(card.unknownLegalFacts.includes('Apple certification'));
    const investment = assessInvestmentReadiness({
      subject: 'brokerage-placeholder',
      jurisdiction: 'US',
      legalEntityId: 'le_solstice_us_inc',
      at: NOW,
    });
    assert.equal(investment.state, 'DEPENDENCY_NOT_IMPLEMENTED');
  });

  it('reports growth-plan and hypothetical PEVE impact without executing', () => {
    const { engine } = world();
    const snapshot = captureRegulatorySnapshot({
      twinId: world().twin.twin.twinId,
      registry: engine.registry,
      capturedAt: NOW,
      effectiveAt: NOW,
    });
    const us = engine.registry.getVersion('us-sim-v1');
    assert.ok(us);
    const impact = assessGrowthPlanImpact({
      productionRegistry: engine.registry,
      candidateVersions: [candidateUsOpenAccountReview(us)],
      baselineSnapshotId: snapshot.snapshotId,
      candidateSetId: asCandidatePolicySetId('cps_growth_plan'),
      planRef: 'gpl_rdt_test',
      actionCategories: ['REDUCE_FEE', 'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE'],
      at: NOW,
    });
    assert.equal(impact.simulationOnly, true);
    const investment = impact.categories.find((row) => row.actionCategory === 'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE');
    assert.equal(investment?.state, 'BECOME_UNSUPPORTED');
    const peve = estimatePeveImpact({
      growthImpact: impact,
      opportunityRefs: ['opp_fee_save_1'],
    });
    assert.equal(peve.label, 'HYPOTHETICAL');
  });

  it('keeps legal assumptions explicit and refuses counsel confirmation', () => {
    const created = createAssumption({
      jurisdiction: 'US',
      subject: 'OPEN_ACCOUNT KYC refresh',
      proposition: 'A refresh review may be required after 12 months',
      sourceReferences: [],
      createdAt: NOW,
      ownerRef: 'operator_rdt',
    });
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('assumption');
    assert.equal(created.value.legalReviewStatus, 'RESEARCH_REQUIRED');
    const ai = changeAssumptionStatus({
      assumption: created.value,
      next: 'COUNSEL_REVIEWED',
      actorKind: 'AI',
      reviewerRef: 'model',
    });
    assert.equal(ai.ok, false);
    const counsel = changeAssumptionStatus({
      assumption: created.value,
      next: 'CONFIRMED_BY_COUNSEL',
      actorKind: 'HUMAN_OPERATOR',
      reviewerRef: 'counsel',
    });
    assert.equal(counsel.ok, false);
    if (counsel.ok) throw new Error('counsel');
    assert.equal(counsel.error.code, 'CONFIRMED_BY_COUNSEL_FORBIDDEN');
    assert.equal(refuseAiLegalStatus('AI').ok, false);
  });

  it('refuses policy activation and customer-scenario access without capability', () => {
    const { twin, stranger, viewer } = world();
    assert.equal(twin.activateCandidatePolicy().code, 'RDT_CANNOT_ACTIVATE_POLICY');
    const preview = twin.previewInvestmentRiskPolicy({
      currentMaxInstrumentConcentration: '60000000',
      candidateMaxInstrumentConcentration: '90000000',
    });
    assert.equal(preview.applied, false);
    assert.equal(preview.wouldLoosenCurrentLimits, true);
    assert.throws(() => twin.productionActivationGuard().activatePack('US', 'us-sim-v2-rdt-open-review'));
    const denied = twin.captureSnapshot(stranger);
    assert.equal(denied.ok, false);
    const historical: RegulatoryScenario = {
      ...usOpen('rsc_cust_hist', 2),
      subjectRef: opaqueSubjectRefFor('cus_real_customer'),
      historicalPolicyPin: { packId: 'US', versionId: 'us-sim-v1' },
      historicalDecision: 'ALLOW',
    };
    const blocked = twin.replay(viewer, historical);
    assert.equal(blocked.ok, false);
    if (blocked.ok) throw new Error('blocked');
    assert.equal(blocked.error.code, 'CUSTOMER_SCENARIO_DENIED');
  });

  it('evaluates the US→SA corridor candidate as DEFER until screening exists', () => {
    const { twin, operator, engine } = world();
    const snapshot = twin.captureSnapshot(operator);
    assert.equal(snapshot.ok, true);
    if (!snapshot.ok) throw new Error('snapshot');
    const us = engine.registry.getVersion('us-sim-v1');
    assert.ok(us);
    const candidate = candidateUsCorridorEnhancedScreening(us);
    const set = twin.registerCandidateSet(operator, {
      label: 'corridor',
      createdAt: NOW,
      versions: [candidate],
      sourceRefs: ['src-engineering-pack-shell'],
      legalReviewStatus: 'RESEARCH_REQUIRED',
      notes: 'enhanced screening',
    });
    assert.equal(set.ok, true);
    if (!set.ok) throw new Error('set');
    const scenario: RegulatoryScenario = {
      scenarioId: asRegulatoryScenarioId('rsc_test_corridor'),
      name: 'corridor',
      category: 'US_SA_CROSS_BORDER',
      createdAt: NOW,
      facts: {
        jurisdiction: classified('US', 'SYNTHETIC_FACT'),
        actorId: classified('rdt_test_actor', 'SYNTHETIC_FACT'),
        customerId: classified('cus_rdt_corridor', 'SYNTHETIC_FACT'),
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
    const result = twin.compare(operator, {
      scenario,
      candidateVersions: [candidate],
      baselineSnapshotId: snapshot.value.snapshotId,
      candidateSetId: set.value.candidateSetId,
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error('corridor');
    assert.equal(result.value.current.decision, 'ALLOW');
    assert.equal(result.value.candidate.decision, 'DEFER');
    assert.ok(result.value.candidate.reasonCodes.includes('CANDIDATE_ENHANCED_SCREENING_REQUIRED'));
    assert.equal(result.value.candidate.executionAuthorityIssued, false);
  });

  it('does not contain a second kernel, policy engine, or ledger mutator', () => {
    const service = readFileSync(join(ROOT, 'packages/regulatory-twin/src/service.ts'), 'utf8');
    assert.equal(/new ComplianceKernel|kernel\.submit|AuthorityIssuer|\.issue\(/.test(service), false);
    assert.equal(/postJournal|postPaymentJournal|postCardJournal|reserveLiquidity/.test(service), false);
    assert.equal(/class PolicyEngine|class ComplianceKernel/.test(service), false);
    const sandbox = readFileSync(join(ROOT, 'packages/regulatory-twin/src/sandbox.ts'), 'utf8');
    assert.match(sandbox, /clonePolicyRegistry/);
    assert.match(sandbox, /Never issues Execution Authority/);
  });
});
