/**
 * HELIOS MD10 — FX, rates, and commodity reference fabric.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  buildCommodityBasisLink,
  buildCommodityDecentralizedConsensus,
  buildFxDecentralizedConsensus,
  buildRateDecentralizedConsensus,
  assertCommodityComparable,
  filterCompatibleFx,
  fixtureEurUsdContributorQuote,
  fixtureEurUsdVenueQuote,
  fixtureUsTenYearYield,
  fixtureWtiFutures,
  fixtureWtiPhysicalBenchmark,
  evaluateMd10Qualification,
  HELIOS_MD10_MACRO_MARKET_REFERENCE_QUALIFIED,
  MD10_FIXTURE_EUR_USD_CONTRIBUTOR_QUOTES,
  requiresCommodityBasisLink,
} from '../packages/platform/src/helios/market-data/md10/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-16T15:00:00.000Z');

describe('HELIOS MD10 macro market reference fabric', () => {
  it('passes HELIOS architectural boundary lint for platform/helios', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const md10 = findings.filter((row) => row.file.includes('market-data/md10'));
    assert.deepEqual(md10, []);
  });

  it('consolidates compatible contributor FX quotes with trimmed median bid/ask', () => {
    const seed = MD10_FIXTURE_EUR_USD_CONTRIBUTOR_QUOTES[0]!;
    const compatible = filterCompatibleFx(seed, [
      ...MD10_FIXTURE_EUR_USD_CONTRIBUTOR_QUOTES,
      fixtureEurUsdVenueQuote({
        observationId: 'fx:eurusd:venue',
        venueId: 'EBS',
        providerId: 'ebs',
        bidNumerator: 107_00n,
        askNumerator: 107_02n,
      }),
    ]);
    assert.equal(compatible.length, MD10_FIXTURE_EUR_USD_CONTRIBUTOR_QUOTES.length);

    const consensus = buildFxDecentralizedConsensus({
      seed,
      observations: MD10_FIXTURE_EUR_USD_CONTRIBUTOR_QUOTES,
      evaluatedAt: NOW,
      estimator: 'TRIMMED_MEDIAN',
      trimCount: 1,
    });
    assert.equal(consensus.status, 'CONSOLIDATED');
    assert.equal(consensus.grantsSingleTruePrice, false);
    assert.ok(consensus.consolidatedBid);
    assert.ok(consensus.consolidatedAsk);
    assert.ok(consensus.consolidatedAsk.numerator >= consensus.consolidatedBid.numerator);
    assert.equal(consensus.sourceCount, MD10_FIXTURE_EUR_USD_CONTRIBUTOR_QUOTES.length);
    assert.ok(consensus.dispersion);
    assert.ok(consensus.dispersion.spanMinorUnits > 0n);
  });

  it('tracks provider, venue, tenor, and timestamp on FX observations', () => {
    const row = fixtureEurUsdContributorQuote({
      observationId: 'fx:tracked',
      providerId: 'bank_x',
      bidNumerator: 108_00n,
      askNumerator: 108_05n,
      observedAt: NOW,
    });
    assert.equal(row.provenance.providerId, 'bank_x');
    assert.equal(row.tenor, 'SPOT');
    assert.equal(row.observedAt, NOW);
    assert.equal(row.provenance.venueId, null);

    const venue = fixtureEurUsdVenueQuote({
      observationId: 'fx:venue',
      venueId: 'LMAX',
      providerId: 'lmax',
      bidNumerator: 108_01n,
      askNumerator: 108_03n,
    });
    assert.equal(venue.provenance.venueId, 'LMAX');
    assert.equal(venue.kind, 'VENUE_QUOTE');
  });

  it('builds rate consensus for government yields', () => {
    const a = fixtureUsTenYearYield('rates:10y:a', 410);
    const b = fixtureUsTenYearYield('rates:10y:b', 412);
    const consensus = buildRateDecentralizedConsensus({ seed: a, observations: [a, b], evaluatedAt: NOW });
    assert.equal(consensus.domain, 'rates');
    assert.equal(consensus.consolidatedValueBps, 411);
    assert.equal(consensus.sourceCount, 2);
  });

  it('rejects futures vs physical crude without explicit basis', () => {
    const futures = fixtureWtiFutures('wti:fut', 72_00n);
    const physical = fixtureWtiPhysicalBenchmark('wti:phys', 70_50n);
    assert.equal(requiresCommodityBasisLink(futures.kind, physical.kind), true);
    const rejected = assertCommodityComparable(futures, physical, null);
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.reason, 'futures_physical_basis_required');
    }

    const basis = buildCommodityBasisLink({
      futures,
      physical,
      basisMinorUnits: 150n,
      documentedAt: NOW,
    });
    assert.ok(basis);
    const accepted = assertCommodityComparable(futures, physical, basis);
    assert.equal(accepted.ok, true);
  });

  it('does not equate WTI futures prices across incompatible contract lanes', () => {
    const dec = fixtureWtiFutures('wti:dec', 72_00n);
    const alternate = Object.freeze({
      ...dec,
      contractMonth: '2027-03',
      provenance: Object.freeze({ ...dec.provenance, observationId: 'wti:mar' }),
    });
    const consensus = buildCommodityDecentralizedConsensus({
      seed: dec,
      observations: [dec, alternate],
      evaluatedAt: NOW,
    });
    assert.equal(consensus.sourceCount, 1);
  });

  it('emits HELIOS_MD10_MACRO_MARKET_REFERENCE_QUALIFIED when harness passes', () => {
    const result = evaluateMd10Qualification();
    assert.equal(result.marker, HELIOS_MD10_MACRO_MARKET_REFERENCE_QUALIFIED, result.blockers.join('; '));
    assert.equal(result.qualified, true);
  });
});
