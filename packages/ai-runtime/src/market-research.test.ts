import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseMarketOpportunityResearch, isCandidateEligibleForRanking } from './market-research.ts';

const candidate = {
  candidateId: 'c1', assetId: 'asset1', symbol: 'SIM', assetName: 'Synthetic',
  assetClass: 'PAPER', market: 'SIMULATION', currency: 'USD',
  strategyClasses: ['BREAKOUT'], timeHorizon: 'MEDIUM_TERM', thesis: 'public thesis',
  catalysts: ['public event'], risks: ['drawdown'], evidence: ['filing', 'price history'],
  liquidityScoreBps: 8_000, momentumScoreBps: 7_000, fundamentalScoreBps: 6_000,
  catalystScoreBps: 6_000, sentimentScoreBps: 5_000, riskScoreBps: 4_000,
  confidenceBps: 7_000, downsideScenarioBps: -1_000, baseScenarioBps: 500,
  upsideScenarioBps: 2_000, asOf: '2026-08-28T00:00:00.000Z',
  sourceRefs: ['public://filing', 'public://prices'],
};

function research(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 'sunrey.market-opportunity-research.v1',
    generatedAt: '2026-08-28T00:00:00.000Z',
    marketRegime: 'RANGE',
    candidates: [candidate],
    warnings: [],
    ...overrides,
  };
}

describe('public market opportunity research contract', () => {
  it('accepts integer basis-point scenarios and evidence', () => {
    const parsed = parseMarketOpportunityResearch(research());
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.value.candidates[0]?.confidenceBps, 7_000);
  });

  it('rejects guarantee fields, floating-point scores, and missing evidence', () => {
    assert.equal(parseMarketOpportunityResearch(research({
      candidates: [{ ...candidate, guaranteedReturn: 0.9 }],
    })).ok, false);
    assert.equal(parseMarketOpportunityResearch(research({
      candidates: [{ ...candidate, confidenceBps: 0.5 }],
    })).ok, false);
    assert.equal(parseMarketOpportunityResearch(research({
      candidates: [{ ...candidate, evidence: [] }],
    })).ok, false);
  });

  it('rejects out-of-range basis-point scores', () => {
    assert.equal(parseMarketOpportunityResearch(research({
      candidates: [{ ...candidate, liquidityScoreBps: 10_001 }],
    })).ok, false);
    assert.equal(parseMarketOpportunityResearch(research({
      candidates: [{ ...candidate, downsideScenarioBps: -1_000_001 }],
    })).ok, false);
  });

  it('requires minimum evidence, liquidity, confidence, and acceptable downside for ranking', () => {
    assert.equal(isCandidateEligibleForRanking(candidate, '2026-08-28T00:00:00.000Z'), true);
    assert.equal(isCandidateEligibleForRanking({ ...candidate, liquidityScoreBps: 4_999 }, candidate.asOf), false);
    assert.equal(isCandidateEligibleForRanking({ ...candidate, downsideScenarioBps: -5_001 }, candidate.asOf), false);
  });
});
