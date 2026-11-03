/**
 * HELIOS Open-Source Integration OS13 — AI strategy generation sandbox.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '@solstice/config';
import { asCustomerId, asJurisdiction, asUtcInstant, type UtcInstant } from '@solstice/domain';
import { DomainEventLog } from '@solstice/events';
import { EvidenceVault } from '@solstice/evidence';
import { SimulatedIdentityAdapter } from '@solstice/identity';
import { ModelRegistry, seedCanonicalRiskModel } from '@solstice/model-registry';
import { defaultSimulationBudget, RiskEngine } from '@solstice/risk';
import { createSimulationKeyProvider } from '@solstice/security';
import {
  EXPLICIT_COSTS,
  equalWeightSpec,
  syntheticTwoEtfDataset,
  StrategyLab,
} from '@solstice/strategy-lab';
import { lintHeliosBoundary } from '../../../../../../tools/architectural-linter/src/helios-guards.ts';
import {
  HELIOS_OS13_AI_STRATEGY_SANDBOX_QUALIFIED,
  PROPOSED_STRATEGY_GENOME_SCHEMA,
  StrategyProposalValidator,
  StrategySandbox,
  buildStrategyProposal,
  collectSafetyViolations,
  evaluateAiStrategySandboxQualification,
  type ProposedStrategyGenome,
  type StrategyFeatureCatalog,
} from './index.ts';

const NOW = asUtcInstant('2026-09-17T08:00:00.000Z');

function day(offset: number): UtcInstant {
  return asUtcInstant(`2026-01-${String(1 + offset).padStart(2, '0')}T00:00:00.000Z`);
}

function catalog(): StrategyFeatureCatalog {
  return Object.freeze({
    hasDataFeature: (featureId: string) =>
      ['daily-close', 'membership', 'corporate-actions'].includes(featureId),
    hasApprovedModel: (modelId: string, version: string) =>
      modelId === 'mdl_investment_pretrade' && version === 'risk-model-v1',
  });
}

function validGenome(): ProposedStrategyGenome {
  return Object.freeze({
    schema: PROPOSED_STRATEGY_GENOME_SCHEMA,
    specificationDraft: equalWeightSpec(EXPLICIT_COSTS),
    parameterSweep: Object.freeze({ cadence: Object.freeze(['WEEKLY', 'DAILY']) }),
    evaluationPlan: Object.freeze({
      train: Object.freeze({ start: day(0), end: day(9), partition: 'TRAIN' as const }),
      validation: Object.freeze({ start: day(10), end: day(17), partition: 'VALIDATION' as const }),
      holdout: Object.freeze({ start: day(18), end: day(27), partition: 'OUT_OF_SAMPLE_TEST' as const }),
      walkForward: Object.freeze({ trainDays: 7, testDays: 3 }),
    }),
    informationTimeAttestation: Object.freeze({
      usesOnlyKnowableObservations: true as const,
      dataRefs: Object.freeze([
        Object.freeze({
          featureId: 'daily-close',
          knowableAt: day(0),
          evaluationHorizonStart: day(0),
        }),
      ]),
    }),
    coverageReportRequired: true as const,
    regimeBreakdownRequired: true as const,
  });
}

function labHarness(subjectId = 'cust_os13') {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  assert.equal(
    identity.provisionSimulatedActor({
      actorId: 'operator_os13',
      jurisdiction: asJurisdiction('US'),
      identityId: 'id_os13',
      customerId: asCustomerId(subjectId),
      capabilities: ['VIEW_ACCOUNT', 'INVESTMENT_OPERATE_REQUEST'],
    }).ok,
    true,
  );
  const actorResult = identity.service.resolveActorContext('operator_os13');
  if (!actorResult.ok) {
    throw new Error('actor');
  }
  const registry = new ModelRegistry();
  assert.equal(seedCanonicalRiskModel(registry, actorResult.value, NOW).ok, true);
  const risk = new RiskEngine({ clock, registry, events, evidence });
  const strategyLab = new StrategyLab({ clock, risk, registry, events, evidence });
  const budget = defaultSimulationBudget({ subjectId, portfolioId: 'inv_os13', reviewBy: NOW });
  risk.putBudget(budget);
  return { clock, evidence, strategyLab, budget, subjectId };
}

describe('HELIOS OS13 AI strategy sandbox', () => {
  it('passes HELIOS boundary lint for OS13 module', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const os13 = findings.filter((row) => row.file.includes('open-source-integration/os13'));
    assert.deepEqual(os13, []);
  });

  it('rejects prohibited executable material in proposals', () => {
    const violations = collectSafetyViolations({ notes: "do not eval('code')" });
    assert.ok(violations.some((row) => row.includes('eval')));
    const validator = new StrategyProposalValidator();
    const proposal = buildStrategyProposal({
      researchAgentRef: 'agent/research/os13',
      genome: {
        ...validGenome(),
        specificationDraft: {
          ...equalWeightSpec(EXPLICIT_COSTS),
          mandateCompatibility: Object.freeze(["eval('x')"]),
        },
      },
      proposedAt: NOW,
    });
    const result = validator.validate(proposal, catalog());
    assert.equal(result.ok, false);
  });

  it('runs proposal through sandbox without deployment authority', () => {
    const ctx = labHarness();
    const proposal = buildStrategyProposal({
      researchAgentRef: 'agent/research/os13',
      genome: validGenome(),
      proposedAt: NOW,
    });
    const sandbox = new StrategySandbox(ctx.strategyLab, ctx.evidence, catalog());
    const outcome = sandbox.processProposal({
      proposal,
      dataset: syntheticTwoEtfDataset(),
      riskBudget: ctx.budget,
      subjectId: ctx.subjectId,
      startingCapitalMinor: 100_000n,
      sealedAt: NOW,
      maxDrawdownBps: 5_000,
    });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) {
      return;
    }
    assert.equal(outcome.value.deployed, false);
    assert.equal(outcome.value.humanPromotionRequired, true);
    assert.equal(outcome.value.evidence.deployAuthorized, false);
    assert.ok(outcome.value.capsuleCandidateFingerprint);
    assert.ok(outcome.value.validationReportId);
    assert.match(outcome.value.selectionReason, /not maximum backtest return/);
    assert.equal(outcome.value.metrics?.promoteOnReturnOnly, false);
    assert.equal(outcome.value.metrics?.explicitCostsApplied, true);
    assert.ok((outcome.value.metrics?.walkForwardFoldCount ?? 0) > 0);
  });

  it('emits HELIOS_OS13_AI_STRATEGY_SANDBOX_QUALIFIED when checks pass', () => {
    const qualification = evaluateAiStrategySandboxQualification({
      proposalValidationStages: true,
      prohibitedNodesBlocked: true,
      informationTimeEnforced: true,
      featureAvailabilityChecked: true,
      boundedParameterSweep: true,
      trainValidationHoldoutRequired: true,
      walkForwardRequired: true,
      explicitCostsRequired: true,
      coverageAndRegimeRequired: true,
      noDeployFromSandbox: true,
      noPromoteOnMaxReturnOnly: true,
      evidenceSealed: true,
      humanPromotionRequired: true,
    });
    assert.equal(qualification.marker, HELIOS_OS13_AI_STRATEGY_SANDBOX_QUALIFIED);
    assert.equal(qualification.qualified, true);
  });
});
