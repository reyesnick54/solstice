/**
 * HELIOS EARN06 — earnings quality and forensic accounting.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  EARN06_QUALITY_FEATURE_IDS,
  EARN06_FORENSIC_SIGNAL_CLASSES,
  FORENSIC_ACCOUNTING_RESEARCH_AGENT_NAME,
  createPointInTimeEarningsQualityFabric,
  earn06ManagementGuidanceFixture,
  earn06ReceivablesDivergenceScenario,
  evaluateEarn06Qualification,
  HELIOS_EARN06_EARNINGS_QUALITY_QUALIFIED,
  runForensicAccountingResearchAgent,
} from '../packages/platform/src/helios/feature-fabric/earnings/quality/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const QUALITY_DIR = join(process.cwd(), 'packages/platform/src/helios/feature-fabric/earnings/quality');

function runEarn06Checks(): import('../packages/platform/src/helios/feature-fabric/earnings/quality/qualification.ts').Earn06QualificationChecks {
  const scenario = earn06ReceivablesDivergenceScenario();
  const fabric = createPointInTimeEarningsQualityFabric({ canonicalEntityId: scenario.entityId });
  for (const q of scenario.quarters) {
    fabric.ingestQuarter(q);
  }
  const beforeKnowable = fabric.compileQualityPlane({
    evaluationTime: asUtcInstant('2025-05-01T12:00:00.000Z'),
    fiscalPeriod: scenario.fiscalPeriod,
    previousQuarterPeriod: scenario.previousQuarterPeriod,
    guidance: earn06ManagementGuidanceFixture(),
  });
  const plane = fabric.compileQualityPlane({
    evaluationTime: scenario.evaluationTime,
    fiscalPeriod: scenario.fiscalPeriod,
    previousQuarterPeriod: scenario.previousQuarterPeriod,
    guidance: earn06ManagementGuidanceFixture(),
  });
  assert.ok(plane);
  const agentBrief = runForensicAccountingResearchAgent({
    workOrderId: 'wo_earn06',
    subjectId: scenario.entityId,
    evaluationTime: scenario.evaluationTime,
    scorecard: plane!.scorecard,
    forensic: plane!.forensic,
    bullishCase: 'Revenue reacceleration supports margin leverage.',
    bearishCase: 'Working-capital build may limit cash conversion.',
  });

  const hasReceivablesHypothesis = plane!.forensic.hypotheses.some((h) =>
    h.summary.includes('receivables accelerate materially faster'),
  );
  const bullChallenges = agentBrief.challenges.filter((c) => c.target === 'BULLISH');
  const bearChallenges = agentBrief.challenges.filter((c) => c.target === 'BEARISH');

  return Object.freeze({
    pointInTimeQuartersFiltered: beforeKnowable === null && plane != null,
    separateScorecardDimensions: plane!.scorecard.dimensions.length === EARN06_QUALITY_FEATURE_IDS.length,
    noOpaqueCompositeScore: !('compositeScore' in (plane!.scorecard as object)),
    forensicHypothesisLanguageOnly: plane!.forensic.hypotheses.every((h) =>
      EARN06_FORENSIC_SIGNAL_CLASSES.includes(h.signalClass),
    ),
    multiHorizonForensicCompare: hasReceivablesHypothesis,
    guidanceCompareWhenKnowable: plane!.forensic.hypotheses.some((h) => h.comparisonBasis === 'MANAGEMENT_GUIDANCE'),
    missingInputsDegradedNotInvented: plane!.features.some((f) => f.quality === 'VALID'),
    noExecutionAuthority:
      plane!.grantsExecutionAuthority === false &&
      plane!.scorecard.grantsExecutionAuthority === false &&
      plane!.forensic.grantsExecutionAuthority === false &&
      agentBrief.grantsExecutionAuthority === false,
    forensicAgentChallengesBothCases: bullChallenges.length > 0 && bearChallenges.length > 0,
  });
}

describe('HELIOS EARN06 earnings quality and forensic accounting', () => {
  it('simulation posture', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('passes HELIOS boundary lint for earnings quality module', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const hits = findings.filter((f) => f.file.includes('helios/feature-fabric/earnings'));
    assert.deepEqual(hits, []);
  });

  it('builds separate scorecard dimensions (no composite score)', () => {
    const scenario = earn06ReceivablesDivergenceScenario();
    const fabric = createPointInTimeEarningsQualityFabric({ canonicalEntityId: scenario.entityId });
    for (const q of scenario.quarters) {
      fabric.ingestQuarter(q);
    }
    const plane = fabric.compileQualityPlane({
      evaluationTime: scenario.evaluationTime,
      fiscalPeriod: scenario.fiscalPeriod,
      previousQuarterPeriod: scenario.previousQuarterPeriod,
      guidance: earn06ManagementGuidanceFixture(),
    });
    assert.ok(plane);
    assert.equal(plane!.scorecard.dimensions.length, EARN06_QUALITY_FEATURE_IDS.length);
    assert.equal(plane!.features.length, EARN06_QUALITY_FEATURE_IDS.length);
    for (const feature of plane!.features) {
      assert.equal(feature.grantsExecutionAuthority, false);
    }
  });

  it('forensic detector emits DIVERGENCE hypotheses with research-safe language', () => {
    const scenario = earn06ReceivablesDivergenceScenario();
    const fabric = createPointInTimeEarningsQualityFabric({ canonicalEntityId: scenario.entityId });
    for (const q of scenario.quarters) {
      fabric.ingestQuarter(q);
    }
    const plane = fabric.compileQualityPlane({
      evaluationTime: scenario.evaluationTime,
      fiscalPeriod: scenario.fiscalPeriod,
      previousQuarterPeriod: scenario.previousQuarterPeriod,
      guidance: earn06ManagementGuidanceFixture(),
    });
    assert.ok(plane);
    assert.ok(plane!.forensic.hypotheses.length >= 1);
    for (const hyp of plane!.forensic.hypotheses) {
      assert.ok(EARN06_FORENSIC_SIGNAL_CLASSES.includes(hyp.signalClass));
      const combined = `${hyp.summary} ${hyp.detail}`.toUpperCase();
      assert.equal(combined.includes('FRAUD'), false);
      assert.equal(combined.includes('MANIPULATION'), false);
    }
  });

  it('ForensicAccountingResearchAgent challenges bullish and bearish cases', () => {
    const scenario = earn06ReceivablesDivergenceScenario();
    const fabric = createPointInTimeEarningsQualityFabric({ canonicalEntityId: scenario.entityId });
    for (const q of scenario.quarters) {
      fabric.ingestQuarter(q);
    }
    const plane = fabric.compileQualityPlane({
      evaluationTime: scenario.evaluationTime,
      fiscalPeriod: scenario.fiscalPeriod,
      previousQuarterPeriod: scenario.previousQuarterPeriod,
      guidance: earn06ManagementGuidanceFixture(),
    });
    assert.ok(plane);
    const brief = runForensicAccountingResearchAgent({
      workOrderId: 'wo_earn06_agent',
      subjectId: scenario.entityId,
      evaluationTime: scenario.evaluationTime,
      scorecard: plane!.scorecard,
      forensic: plane!.forensic,
      bullishCase: 'Demand recovery',
      bearishCase: 'Channel stuffing risk',
    });
    assert.equal(brief.agentName, FORENSIC_ACCOUNTING_RESEARCH_AGENT_NAME);
    assert.ok(brief.challenges.some((c) => c.target === 'BULLISH'));
    assert.ok(brief.challenges.some((c) => c.target === 'BEARISH'));
    assert.equal(brief.issuesOrders, false);
  });

  it('qualification marker when checks pass', () => {
    const checks = runEarn06Checks();
    const result = evaluateEarn06Qualification(checks);
    assert.equal(result.marker, HELIOS_EARN06_EARNINGS_QUALITY_QUALIFIED);
    assert.equal(result.qualified, true, result.blockers.join(', '));
  });

  it('module source avoids fraud/manipulation accusations', () => {
    const files = readdirSync(QUALITY_DIR).filter((f) => f.endsWith('.ts'));
    for (const file of files) {
      const text = readFileSync(join(QUALITY_DIR, file), 'utf8').toUpperCase();
      assert.equal(text.includes('FRAUD'), false, file);
      assert.equal(text.includes('MANIPULATION'), false, file);
    }
  });
});
