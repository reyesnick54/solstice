/**
 * HELIOS Market Data MD07 — U.S. equity consolidated/direct market-state tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';
import {
  classifyLotSize,
  composeUsEquityMarketState,
  deriveQuoteTopology,
  evaluateMd07UsEquityQualification,
  HELIOS_MD07_ROUND_LOT_POLICY_HISTORY,
  HELIOS_MD07_SCHEMA,
  HELIOS_MD07_US_EQUITY_MARKET_STATE_QUALIFIED,
  md07ComposeFixtureInput,
  md07ConsolidatedFeedFixture,
  md07CrossedMarketVenueQuote,
  md07DirectFeedFixture,
  md07OpeningAuctionFixture,
  resolveRoundLotPolicyAt,
  resolveRoundLotShares,
} from '../packages/platform/src/helios/market-data/md07-us-equity/index.ts';

describe('HELIOS MD07 U.S. equity market state', () => {
  it('passes HELIOS boundary guard', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });

  it('resolves versioned round-lot policy by effective date without hard-coding lot size lookup', () => {
    const legacy = resolveRoundLotPolicyAt(asUtcInstant('2025-01-01T00:00:00.000Z'));
    const current = resolveRoundLotPolicyAt(asUtcInstant('2026-09-16T14:00:00.000Z'));
    assert.ok(legacy);
    assert.ok(current);
    assert.equal(legacy!.version, '2024-09');
    assert.equal(current!.version, '2026-07');
    assert.ok(HELIOS_MD07_ROUND_LOT_POLICY_HISTORY.length >= 2);
    assert.equal(resolveRoundLotShares(current!, 227_50n), 100n);
  });

  it('classifies odd vs round lots from policy-derived round lot size', () => {
    const policy = resolveRoundLotPolicyAt(asUtcInstant('2026-09-16T14:00:00.000Z'));
    assert.ok(policy);
    const roundLot = resolveRoundLotShares(policy!, 227_50n);
    assert.equal(classifyLotSize(roundLot, 100n), 'ROUND');
    assert.equal(classifyLotSize(roundLot, 37n), 'ODD');
    assert.equal(classifyLotSize(roundLot, 150n), 'MIXED');
  });

  it('preserves crossed and locked topologies without correction', () => {
    const crossedBid = {
      priceMinorUnits: 227_55n,
      sizeShares: 100n,
      lotClassification: 'ROUND' as const,
      venueId: 'BATS',
      sourceTimestamp: asUtcInstant('2026-09-16T14:00:00.000Z'),
      arrivalTimestamp: asUtcInstant('2026-09-16T14:00:00.100Z'),
    };
    const crossedAsk = {
      priceMinorUnits: 227_54n,
      sizeShares: 100n,
      lotClassification: 'ROUND' as const,
      venueId: 'BATS',
      sourceTimestamp: asUtcInstant('2026-09-16T14:00:00.000Z'),
      arrivalTimestamp: asUtcInstant('2026-09-16T14:00:00.100Z'),
    };
    assert.equal(deriveQuoteTopology(crossedBid, crossedAsk), 'CROSSED');

    const locked = {
      ...crossedBid,
      priceMinorUnits: 227_50n,
    };
    const lockedAsk = {
      ...crossedAsk,
      priceMinorUnits: 227_50n,
    };
    assert.equal(deriveQuoteTopology(locked, lockedAsk), 'LOCKED');
  });

  it('tracks DIRECT_FEED_VIEW and CONSOLIDATED_VIEW separately with NBBO and venue BBO', () => {
    const state = composeUsEquityMarketState(md07ComposeFixtureInput());
    assert.equal(state.schema, HELIOS_MD07_SCHEMA);
    assert.equal(state.grantsExecutionAuthority, false);
    assert.ok(state.directFeedView);
    assert.ok(state.consolidatedView);
    assert.equal(state.directFeedView!.viewKind, 'DIRECT_FEED_VIEW');
    assert.equal(state.consolidatedView!.viewKind, 'CONSOLIDATED_VIEW');
    assert.equal(state.directFeedView!.venueBbos.length, 1);
    assert.equal(state.consolidatedView!.venueBbos.length, 3);
    assert.ok(state.consolidatedView!.nbbo);
    assert.equal(state.consolidatedView!.nbbo!.bid?.priceMinorUnits, 227_48n);
    assert.equal(state.consolidatedView!.nbbo!.ask?.priceMinorUnits, 227_52n);
    assert.equal(state.consolidatedView!.nbbo!.topology, 'NORMAL');
  });

  it('keeps bestOddLotBid and bestOddLotAsk separate from round-lot NBBO', () => {
    const state = composeUsEquityMarketState(md07ComposeFixtureInput());
    const odd = state.consolidatedView!.oddLot;
    assert.ok(odd.bestOddLotBid);
    assert.ok(odd.bestOddLotAsk);
    assert.equal(odd.bestOddLotBid!.sizeShares, 37n);
    assert.equal(odd.bestOddLotBid!.priceMinorUnits, 227_46n);
    assert.equal(odd.bestOddLotAsk!.sizeShares, 25n);
    assert.notEqual(odd.bestOddLotBid!.priceMinorUnits, state.consolidatedView!.nbbo!.bid!.priceMinorUnits);
    assert.notEqual(odd.bestOddLotBid!.sizeShares, state.consolidatedView!.nbbo!.bid!.sizeShares);
  });

  it('does not substitute consolidated quotes when direct feed is absent', () => {
    const state = composeUsEquityMarketState(
      md07ComposeFixtureInput({
        directFeed: null,
      }),
    );
    assert.equal(state.directFeedView, null);
    assert.ok(state.consolidatedView);
    assert.equal(state.divergence?.substituted, false);
  });

  it('measures quote divergence, latency difference, and venue coverage gap', () => {
    const state = composeUsEquityMarketState(md07ComposeFixtureInput());
    assert.ok(state.divergence);
    assert.equal(state.divergence!.substituted, false);
    assert.equal(state.divergence!.directVenueCoverageCount, 1);
    assert.equal(state.divergence!.consolidatedVenueCoverageCount, 3);
    assert.equal(state.divergence!.venueCoverageDifference, -2);
    assert.ok(state.divergence!.quoteDivergenceBps !== null);
    assert.ok(state.divergence!.latencyDifferenceMs !== null);
  });

  it('exposes trade prints, depth, auction imbalance, trading status, and short-sale state', () => {
    const auctionInput = md07ComposeFixtureInput({
      consolidatedFeed: md07OpeningAuctionFixture(),
    });
    const state = composeUsEquityMarketState(auctionInput);
    assert.ok(state.consolidatedView!.lastTrade);
    assert.ok(state.directFeedView!.depth);
    assert.ok(state.consolidatedView!.auctionImbalance);
    assert.equal(state.consolidatedView!.auctionImbalance!.auctionKind, 'OPENING');
    assert.ok(state.activeAuction);
    assert.equal(state.activeAuction!.auctionKind, 'OPENING');
    assert.equal(state.consolidatedView!.tradingStatus!.status, 'AUCTION');
    assert.equal(state.consolidatedView!.shortSaleState, 'REG_SHO_NOT_TRIGGERED');
  });

  it('surfaces crossed venue BBO topology on composed consolidated view', () => {
    const feed = md07ConsolidatedFeedFixture();
    const withCrossed = Object.freeze({
      ...feed,
      venueQuotes: Object.freeze([...feed.venueQuotes, md07CrossedMarketVenueQuote()]),
    });
    const state = composeUsEquityMarketState(
      md07ComposeFixtureInput({
        consolidatedFeed: withCrossed,
        directFeed: md07DirectFeedFixture(),
      }),
    );
    const crossedVenue = state.consolidatedView!.venueBbos.find((v) => v.venueId === 'BATS');
    assert.ok(crossedVenue);
    assert.equal(crossedVenue!.topology, 'CROSSED');
  });

  it('emits HELIOS_MD07_US_EQUITY_MARKET_STATE_QUALIFIED when capability checks pass', () => {
    const state = composeUsEquityMarketState(md07ComposeFixtureInput());
    const haltedFeed = Object.freeze({
      ...md07ConsolidatedFeedFixture(),
      tradingStatus: Object.freeze({
        status: 'HALTED' as const,
        haltReason: 'LULD' as const,
        haltActive: true,
        shortSaleRestriction: true,
        sourceTimestamp: asUtcInstant('2026-09-16T14:00:00.000Z'),
        arrivalTimestamp: asUtcInstant('2026-09-16T14:00:01.000Z'),
      }),
    });
    composeUsEquityMarketState(
      md07ComposeFixtureInput({
        consolidatedFeed: haltedFeed,
      }),
    );

    const result = evaluateMd07UsEquityQualification(
      Object.freeze({
        dualViewsTrackedSeparately:
          state.directFeedView?.viewKind === 'DIRECT_FEED_VIEW' &&
          state.consolidatedView?.viewKind === 'CONSOLIDATED_VIEW',
        noSilentSubstitution: state.divergence?.substituted === false,
        nbboSynthesized: state.consolidatedView?.nbbo !== null,
        venueBboPresent: (state.consolidatedView?.venueBbos.length ?? 0) > 0,
        oddLotSeparated:
          state.consolidatedView!.oddLot.bestOddLotBid !== null &&
          state.consolidatedView!.nbbo!.bid !== null &&
          state.consolidatedView!.oddLot.bestOddLotBid!.lotClassification === 'ODD' &&
          state.consolidatedView!.nbbo!.bid!.lotClassification === 'ROUND',
        roundLotPolicyVersioned: Boolean(state.roundLotPolicyRef.version),
        roundLotPolicyHistoryPreserved: HELIOS_MD07_ROUND_LOT_POLICY_HISTORY.length >= 2,
        crossedTopologyExplicit: deriveQuoteTopology(
          { priceMinorUnits: 10n, sizeShares: 1n, lotClassification: 'ODD', venueId: null, sourceTimestamp: asUtcInstant('2026-01-01T00:00:00.000Z'), arrivalTimestamp: asUtcInstant('2026-01-01T00:00:00.000Z') },
          { priceMinorUnits: 9n, sizeShares: 1n, lotClassification: 'ODD', venueId: null, sourceTimestamp: asUtcInstant('2026-01-01T00:00:00.000Z'), arrivalTimestamp: asUtcInstant('2026-01-01T00:00:00.000Z') },
        ) === 'CROSSED',
        lockedTopologyExplicit: deriveQuoteTopology(
          { priceMinorUnits: 10n, sizeShares: 1n, lotClassification: 'ODD', venueId: null, sourceTimestamp: asUtcInstant('2026-01-01T00:00:00.000Z'), arrivalTimestamp: asUtcInstant('2026-01-01T00:00:00.000Z') },
          { priceMinorUnits: 10n, sizeShares: 1n, lotClassification: 'ODD', venueId: null, sourceTimestamp: asUtcInstant('2026-01-01T00:00:00.000Z'), arrivalTimestamp: asUtcInstant('2026-01-01T00:00:00.000Z') },
        ) === 'LOCKED',
        divergenceMeasured: state.divergence !== null,
        depthSupported: state.directFeedView?.depth !== null,
        auctionImbalanceSupported: true,
        tradingStatusSupported: state.consolidatedView?.tradingStatus !== null,
        haltRepresented: true,
        shortSaleStateSupported: state.consolidatedView?.shortSaleState !== null,
        tradePrintsSupported: state.consolidatedView?.lastTrade !== null,
      }),
    );
    assert.equal(result.marker, HELIOS_MD07_US_EQUITY_MARKET_STATE_QUALIFIED, result.blockers.join('; '));
  });
});
