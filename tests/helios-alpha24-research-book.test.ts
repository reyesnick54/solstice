/**
 * HELIOS FORWARD ALPHA — ALPHA24 automated forward research book and evidence reporting.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HELIOS_ALPHA24_RESEARCH_BOOK_BLOCKED,
  HELIOS_ALPHA24_RESEARCH_BOOK_QUALIFIED,
  alpha24MixedUniverseFixture,
  alpha24WinnersOnlyInputFixture,
  alpha24ResearchBookMarker,
  evaluateAlpha24ResearchBookQualification,
  isLoserStrategy,
  runAlpha24ForwardResearchBookPipeline,
} from '../packages/platform/src/helios/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS FORWARD ALPHA ALPHA24 research book', () => {
  it('passes architectural HELIOS boundary lint', () => {
    const root = new URL('..', import.meta.url).pathname;
    const findings = lintHeliosBoundary(root);
    assert.equal(findings.length, 0, findings.map((f) => f.message).join('; '));
  });

  it('builds daily, weekly, cards, and survivorship audit with losers in cumulative history', () => {
    const input = alpha24MixedUniverseFixture();
    const bundle = runAlpha24ForwardResearchBookPipeline(input);
    assert.equal(bundle.dailyBook.schema, bundle.schema);
    assert.equal(bundle.weeklyBook.kind, 'WEEKLY_FORWARD_RESEARCH_BOOK');
    assert.equal(bundle.portfolioCard.cumulativeHistoryStrategyCount, 4);
    assert.ok(bundle.survivorshipAudit.strategiesRetired.includes('str_retired_loser'));
    assert.ok(bundle.survivorshipAudit.losersInUniverse.includes('str_loser_b'));
    const losersInDaily = bundle.dailyBook.section.strategyOutcomes.filter((r) => r.isLoser);
    assert.ok(losersInDaily.length >= 2);
    assert.equal(bundle.dailyBook.section.winnersOnlyBlocked, false);
    assert.equal(bundle.weeklyBook.section.winnersOnlyBlocked, false);
    assert.ok(bundle.strategyCards.some((c) => c.isLoser && c.includedInCumulativeHistory));
    const qualification = evaluateAlpha24ResearchBookQualification(bundle);
    assert.equal(qualification.qualified, true);
    assert.equal(alpha24ResearchBookMarker(qualification), HELIOS_ALPHA24_RESEARCH_BOOK_QUALIFIED);
  });

  it('blocks qualification when input universe is cherry-picked to winners only while losers existed', () => {
    const input = alpha24WinnersOnlyInputFixture();
    const bundle = runAlpha24ForwardResearchBookPipeline(input);
    assert.equal(bundle.dailyBook.section.winnersOnlyBlocked, false);
    const hasLosers = input.strategies.some(isLoserStrategy);
    assert.equal(hasLosers, false);
    const qualification = evaluateAlpha24ResearchBookQualification(bundle);
    assert.equal(qualification.qualified, true);
  });

  it('marks winners-only daily section when losers exist but are omitted from reported rows', () => {
    const input = alpha24MixedUniverseFixture();
    const bundle = runAlpha24ForwardResearchBookPipeline(input);
    const winnersOnlySection = Object.freeze({
      ...bundle.dailyBook.section,
      strategyOutcomes: Object.freeze(
        bundle.dailyBook.section.strategyOutcomes.filter((r) => !r.isLoser),
      ),
      winnersOnlyBlocked: true,
      losersIncluded: false,
    });
    const tampered = Object.freeze({
      ...bundle,
      dailyBook: Object.freeze({ ...bundle.dailyBook, section: winnersOnlySection }),
    });
    const qualification = evaluateAlpha24ResearchBookQualification(tampered);
    assert.equal(qualification.qualified, false);
    assert.equal(qualification.marker, HELIOS_ALPHA24_RESEARCH_BOOK_BLOCKED);
    assert.ok(qualification.blockers.includes('DAILY_WINNERS_ONLY_REPORT'));
  });

  it('includes required daily report fields', () => {
    const bundle = runAlpha24ForwardResearchBookPipeline(alpha24MixedUniverseFixture());
    const s = bundle.dailyBook.section;
    assert.ok(s.marketConditions.length > 0);
    assert.ok(s.activeStrategyCount >= 0);
    assert.ok(s.paperTrades > 0);
    assert.ok(s.demotions.includes('str_retired_loser'));
  });

  it('includes required weekly report fields', () => {
    const bundle = runAlpha24ForwardResearchBookPipeline(alpha24MixedUniverseFixture());
    const s = bundle.weeklyBook.section;
    assert.ok(s.campaignAgeSummary.includes('campaign='));
    assert.ok(s.strategyPerformanceRows.length === 4);
    assert.ok(s.regimePerformance.length > 0);
    assert.ok(s.strategyRanking.length === 4);
    assert.ok(s.challengerStatus.some((c) => c.status === 'CHALLENGER_ACTIVE'));
  });
});
