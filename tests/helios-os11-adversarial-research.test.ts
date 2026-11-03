import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_OS11_ADVERSARIAL_RESEARCH_QUALIFIED,
  MAX_REBUTTAL_ROUNDS,
  assertEvidencePackUnchanged,
  debateBoostsInformationValue,
  enrichResearchValueWithDebate,
  freezeEvidencePack,
  permitAdditionalDebateRound,
  runResearchDebate,
  type DebateEvidenceRef,
} from '../packages/platform/src/helios/open-source/os11-adversarial-research/index.ts';
import { evaluateResearchValue } from '../packages/platform/src/helios/meta-allocator/research-value.ts';
import { initialBudgetSnapshot } from '../packages/platform/src/helios/budget.ts';

const NOW = asUtcInstant('2026-11-03T06:30:00.000Z');

function evidence(overrides: Partial<DebateEvidenceRef> = {}): DebateEvidenceRef {
  return Object.freeze({
    evidenceId: overrides.evidenceId ?? 'ev_os11_1',
    sourceKind: overrides.sourceKind ?? 'MARKET_OBSERVATION',
    sourceRef: overrides.sourceRef ?? 'obs/sim-etf-1',
    observedAt: overrides.observedAt ?? NOW,
    freshnessOk: overrides.freshnessOk ?? true,
    entitlementOk: overrides.entitlementOk ?? true,
    provenanceRef: overrides.provenanceRef ?? 'prov/os11',
  });
}

describe('HELIOS OS11 adversarial research and consensus', () => {
  it('exports qualification marker HELIOS_OS11_ADVERSARIAL_RESEARCH_QUALIFIED', () => {
    assert.equal(
      HELIOS_OS11_ADVERSARIAL_RESEARCH_QUALIFIED,
      'HELIOS_OS11_ADVERSARIAL_RESEARCH_QUALIFIED',
    );
  });

  it('1. freezes evidence pack and rejects post-freeze mutation', () => {
    const pack = freezeEvidencePack({
      packId: 'pack_1',
      evidence: Object.freeze([evidence()]),
      frozenAt: NOW,
    });
    assert.ok(pack.contentHash.length > 0);
    assertEvidencePackUnchanged(pack, Object.freeze([evidence()]));
    assert.throws(() =>
      assertEvidencePackUnchanged(pack, Object.freeze([evidence({ freshnessOk: false })])),
    );
  });

  it('2. runs bull/bear/risk on the same frozen evidence', () => {
    const bundle = Object.freeze([
      evidence({ evidenceId: 'ev_fresh' }),
      evidence({ evidenceId: 'ev_stale', freshnessOk: false }),
    ]);
    const debate = runResearchDebate({
      debateId: 'deb_1',
      workOrderId: 'wo_os11',
      subjectId: 'cust_os11',
      objective: 'Evaluate relative-value sleeve',
      evidence: bundle,
      now: NOW,
    });
    assert.equal(debate.phase, 'COMPLETED');
    assert.equal(debate.frozenEvidencePack.evidence.length, 2);
    assert.ok(debate.bullCase.claims.length >= 1);
    assert.ok(debate.bearCase.claims.length >= 1);
    assert.ok(debate.riskCase.claims.length >= 1);
    assert.equal(debate.grantsFinancialAuthority, false);
  });

  it('3. allows exactly one rebuttal round with structured counter-evidence', () => {
    const debate = runResearchDebate({
      debateId: 'deb_2',
      workOrderId: 'wo_os11_b',
      subjectId: 'cust_os11_b',
      objective: 'Directional equity review',
      evidence: Object.freeze([evidence(), evidence({ evidenceId: 'ev_2', freshnessOk: false })]),
      now: NOW,
    });
    assert.ok(debate.rebuttals.length >= 2);
    for (const row of debate.rebuttals) {
      assert.equal(row.round, MAX_REBUTTAL_ROUNDS);
      assert.ok(row.targetClaimId.length > 0);
      assert.ok(row.counterStatement.length > 0);
    }
  });

  it('4. synthesis preserves disagreement and marks consensus is not truth', () => {
    const debate = runResearchDebate({
      debateId: 'deb_3',
      workOrderId: 'wo_os11_c',
      subjectId: 'cust_os11_c',
      objective: 'Conflicting signals',
      evidence: Object.freeze([evidence(), evidence({ evidenceId: 'ev_stale', freshnessOk: false })]),
      now: NOW,
    });
    assert.equal(debate.synthesis.preservedDisagreement, true);
    assert.equal(debate.synthesis.consensusIsNotTruth, true);
    assert.ok(debate.synthesis.pointsOfDisagreement.length > 0);
    assert.equal(debate.consensus.consensusIsNotTruth, true);
    assert.ok(debate.consensus.pointsOfDisagreement.length > 0);
  });

  it('5. ResearchConsensus exposes required output fields with evidence refs', () => {
    const debate = runResearchDebate({
      debateId: 'deb_4',
      workOrderId: 'wo_os11_d',
      subjectId: 'cust_os11_d',
      objective: 'Cash yield opportunity',
      evidence: Object.freeze([evidence()]),
      now: NOW,
    });
    const c = debate.consensus;
    assert.ok(Array.isArray(c.bullishEvidence));
    assert.ok(Array.isArray(c.bearishEvidence));
    assert.ok(c.keyUnknowns.length > 0);
    assert.ok(c.disagreementScore >= 0);
    assert.ok(c.confidenceRange.highBps >= c.confidenceRange.lowBps);
    assert.ok(Array.isArray(c.dominantRiskFactors));
    assert.ok(Array.isArray(c.informationGaps));
    assert.ok(c.suggestedResearchNextSteps.length > 0);
    assert.ok(c.evidenceRefs.length > 0);
  });

  it('6. H20: high material disagreement can boost information value', () => {
    const debate = runResearchDebate({
      debateId: 'deb_5',
      workOrderId: 'wo_os11_e',
      subjectId: 'cust_os11_e',
      objective: 'High-stakes macro hedge',
      evidence: Object.freeze([
        evidence(),
        evidence({ evidenceId: 'ev_stale', freshnessOk: false }),
        evidence({ evidenceId: 'ev_risk', sourceKind: 'RISK_SIGNAL', sourceRef: 'risk/vol-spike' }),
      ]),
      now: NOW,
    });
    const enriched = enrichResearchValueWithDebate({
      base: Object.freeze({
        evidenceQuality: 'MEDIUM',
        unresolvedUncertainty: 'MEDIUM',
        specialistDisagreement: false,
        estimatedOpportunitySizeMinor: '250000',
        confidenceState: 'LOW_CONFIDENCE',
        calibratedProbabilityBps: null,
        estimatedResearchCostMinor: '400',
        opportunityHalfLifeHours: 72,
        timeRemainingHours: 60,
        dataAvailable: true,
        accountSizeFeasible: true,
      }),
      metric: debate.disagreementMetric,
      consensus: debate.consensus,
    });
    assert.equal(enriched.specialistDisagreement, true);
    const budget = initialBudgetSnapshot({ ceilingAmount: '10000', unitKind: 'MONETARY_MINOR', currency: 'USD' });
    const assessment = evaluateResearchValue(enriched, budget, null);
    if (debateBoostsInformationValue(debate.disagreementMetric)) {
      assert.ok(['HIGH', 'MEDIUM'].includes(assessment.informationValueTier));
    }
  });

  it('7. H20: low-value disagreement must not permit infinite debate rounds', () => {
    const debate = runResearchDebate({
      debateId: 'deb_6',
      workOrderId: 'wo_os11_f',
      subjectId: 'cust_os11_f',
      objective: 'Low materiality check',
      evidence: Object.freeze([evidence()]),
      now: NOW,
    });
    if (debate.disagreementMetric.lowValueDisagreement) {
      assert.equal(
        permitAdditionalDebateRound({ metric: debate.disagreementMetric, completedRounds: 0 }),
        false,
      );
    }
    assert.equal(
      permitAdditionalDebateRound({ metric: debate.disagreementMetric, completedRounds: MAX_REBUTTAL_ROUNDS }),
      false,
    );
  });

  it('8. deterministic replay under frozen clock', () => {
    const clock = new FrozenClock(NOW);
    const input = Object.freeze({
      debateId: 'deb_7',
      workOrderId: 'wo_os11_g',
      subjectId: 'cust_os11_g',
      objective: 'Replay',
      evidence: Object.freeze([evidence()]),
      now: clock.now(),
    });
    const a = runResearchDebate(input);
    const b = runResearchDebate(input);
    assert.equal(a.consensus.disagreementScore, b.consensus.disagreementScore);
    assert.deepEqual(a.consensus.pointsOfDisagreement, b.consensus.pointsOfDisagreement);
  });
});
