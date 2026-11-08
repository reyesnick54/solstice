/**
 * HELIOS Forward Alpha ALPHA13 — multi-strategy portfolio forward evidence.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_QUALIFIED,
  HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_BLOCKED,
  alpha13DiversifiedLegs,
  alpha13OverlappingAaplLegs,
  alpha13PortfolioForwardEvidenceMarker,
  assertNoCapitalDoubleCount,
  createForwardStrategyPortfolio,
  defaultAlpha13QualificationPolicy,
  runAlpha13PortfolioForwardEvidencePipeline,
} from '../packages/platform/src/helios/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const CAPITAL = '100000000';

describe('HELIOS Forward Alpha ALPHA13 portfolio forward evidence', () => {
  it('passes architectural HELIOS boundary lint', () => {
    const root = new URL('..', import.meta.url).pathname;
    const findings = lintHeliosBoundary(root);
    assert.equal(findings.length, 0, findings.map((f) => f.message).join('; '));
  });

  it('aggregates overlapping AAPL exposure into one combined economic position', () => {
    const portfolio = createForwardStrategyPortfolio({
      portfolioId: 'pf_alpha13_overlap',
      totalCapitalMinor: CAPITAL,
      legs: alpha13OverlappingAaplLegs(),
    });
    const { evidence } = runAlpha13PortfolioForwardEvidencePipeline({ portfolio });
    const aapl = evidence.interaction.combinedExposures.find((row) => row.instrumentId === 'AAPL');
    assert.ok(aapl);
    assert.equal(aapl!.contributingStrategies.length, 2);
    assert.ok(aapl!.netWeightBps > 0);
    assert.ok(
      evidence.interaction.interactions.some((ix) => ix.kind === 'OVERLAPPING_POSITION' && ix.instrumentId === 'AAPL'),
    );
    assert.ok(evidence.alphaDoubleCountBlockedBps > 0);
    assert.equal(evidence.capitalDoubleCountDetected, false);
    assert.equal(assertNoCapitalDoubleCount(evidence.allocation), null);
  });

  it('blocks qualification when correlated strategies double-count one edge', () => {
    const portfolio = createForwardStrategyPortfolio({
      portfolioId: 'pf_alpha13_corr',
      totalCapitalMinor: CAPITAL,
      legs: alpha13OverlappingAaplLegs(),
    });
    const { qualification } = runAlpha13PortfolioForwardEvidencePipeline({ portfolio });
    assert.equal(qualification.qualified, false);
    assert.equal(qualification.marker, HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_BLOCKED);
    assert.ok(qualification.blockers.includes('CORRELATED_EDGE_EXPRESSIONS'));
    assert.ok(qualification.blockers.includes('ALPHA_DOUBLE_COUNT_EXCESS'), qualification.blockers.join('; '));
  });

  it('qualifies diversified independent sleeves with shared capital conserved', () => {
    const portfolio = createForwardStrategyPortfolio({
      portfolioId: 'pf_alpha13_diversified',
      totalCapitalMinor: CAPITAL,
      legs: alpha13DiversifiedLegs(),
    });
    const policy = defaultAlpha13QualificationPolicy();
    const { evidence, qualification } = runAlpha13PortfolioForwardEvidencePipeline({
      portfolio,
      allocationPolicy: { cashReserveBps: 1_000 },
      qualificationPolicy: { ...policy, minPortfolioActiveReturnBps: 80 },
    });
    assert.equal(evidence.allocation.capitalConserved, true);
    assert.equal(evidence.alphaBreadth.classification, 'MANY_INDEPENDENT_EDGES');
    assert.ok(evidence.alphaBreadth.breadthScoreBps >= policy.minBreadthScoreBps);
    assert.ok(evidence.strategyContributions.length === 3);
    const alphaSum = evidence.strategyContributions.reduce((acc, row) => acc + row.alphaContributionBps, 0);
    assert.ok(Math.abs(alphaSum - evidence.deduplicatedAlphaBps) <= 2);
    assert.equal(qualification.qualified, true);
    assert.equal(alpha13PortfolioForwardEvidenceMarker(qualification), HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_QUALIFIED);
  });

  it('detects offsetting gross exposure when legs take opposing weights on the same name', () => {
    const legs = alpha13DiversifiedLegs();
    const { evidence } = runAlpha13PortfolioForwardEvidencePipeline({
      portfolio: createForwardStrategyPortfolio({
        portfolioId: 'pf_alpha13_offset',
        totalCapitalMinor: CAPITAL,
        legs,
      }),
    });
    const energy = evidence.interaction.combinedExposures.find((row) => row.instrumentId === 'XOM');
    assert.ok(energy);
    assert.ok(energy!.grossWeightBps > Math.abs(energy!.netWeightBps));
    assert.ok(
      evidence.interaction.interactions.some((ix) => ix.kind === 'OFFSETTING_TRADE' && ix.instrumentId === 'XOM'),
    );
  });
});
