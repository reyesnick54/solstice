/**
 * HELIOS NATIVE10 — TradingAgents data + memory assimilation qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { systemClock } from '../packages/config/src/clock.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  TradingAgentsDecisionMemoryStore,
  evaluateNative10TradingAgentsDataQualification,
  HELIOS_NATIVE_TRADINGAGENTS_DATA_QUALIFIED,
  packageResearchRunContext,
  renderPortfolioBlock,
  sealDecisionMemoryEntry,
  sealResearchContextPackage,
  assertNoPythonProductionDependency,
} from '../packages/agentic-capital-mesh/src/tradingagents-native/index.ts';
import { bindSecFilingsToAafRevisionLedger } from '../packages/economic-awareness-fabric/src/integrations/sec-filing-revisions.ts';
import {
  SIMCORP_ENTITY_ID,
  SIMCORP_Q2_2024_10Q,
  SIMCORP_SUBMISSION_TIMELINE,
  ingestSecFundamentalSubmissions,
  mapSecObservationsToAafFilingSources,
} from '../packages/external-data/src/sec-fundamentals/index.ts';
import { createDefaultAdapterStates } from '../packages/external-data/src/adapters.ts';
import {
  asOf,
  asOfWindow,
  inWindow,
  normalizeSymbol,
  routeTradingAgentsDataflow,
  evaluateNative10DataflowChecks,
} from '../packages/external-data/src/tradingagents-native/index.ts';
import { mapSecObservationsToHeliosFacts } from '../packages/external-data/src/sec-fundamentals/helios-mapper.ts';
import {
  createHeliosFundamentalFeatureFabric,
  defaultTradingAgentsResearchDataManifest,
  evaluateHeliosOs10PointInTimeFundamentalsQualification,
  type FundamentalFactRecord,
} from '../packages/platform/src/helios/feature-fabric/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2024-10-15T12:00:00.000Z');

describe('HELIOS NATIVE10 TradingAgents data + memory assimilation', () => {
  it('passes HELIOS boundary lint for native modules', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const scoped = findings.filter(
      (f) =>
        f.file.includes('tradingagents-native') ||
        f.file.includes('feature-fabric/research-data-manifest'),
    );
    assert.deepEqual(scoped, []);
  });

  it('date-window discipline clamps model dates to trade date', () => {
    assert.equal(asOf('2024-09-01', '2024-08-15'), '2024-08-15');
    const [start, end] = asOfWindow('2024-07-01', '2024-09-01', '2024-08-15');
    assert.equal(end, '2024-08-15');
    assert.ok(start <= end);
    assert.equal(inWindow('2024-08-20T12:00:00.000Z', '2024-08-01', '2024-08-15', NOW), false);
  });

  it('symbol normalization maps broker symbols to vendor symbols', () => {
    assert.equal(normalizeSymbol('XAUUSD'), 'GC=F');
    assert.equal(normalizeSymbol('EURUSD'), 'EURUSD=X');
    assert.equal(normalizeSymbol('700.HK'), '0700.HK');
  });

  it('router falls back from withheld yfinance to SEC EDGAR for historical fundamentals', () => {
    const ingested = ingestSecFundamentalSubmissions(SIMCORP_SUBMISSION_TIMELINE);
    const outcome = routeTradingAgentsDataflow(
      {
        method: 'get_income_statement',
        symbol: 'SIMC',
        tradeDate: '2024-08-15',
      },
      {
        ctx: { nowUtc: NOW, states: createDefaultAdapterStates() },
        secSubmissions: SIMCORP_SUBMISSION_TIMELINE,
      },
      { dataVendors: { fundamental_data: 'yfinance,sec_edgar' } },
    );
    assert.equal(outcome.kind, 'payload');
    if (outcome.kind === 'payload') {
      assert.equal(outcome.vendorId, 'sec_edgar');
      assert.ok(Date.parse(outcome.knowableAt) <= Date.parse('2024-08-15T23:59:59.000Z'));
    }
  });

  it('decision memory excludes not-yet-resolved lessons from backtest context', () => {
    const memory = new TradingAgentsDecisionMemoryStore();
    memory.storeDecision({
      entryId: 'e1',
      ticker: 'SIMC',
      tradeDate: '2024-07-01',
      decisionText: 'Buy SIMC',
      recordedAt: asUtcInstant('2024-07-01T18:00:00.000Z'),
    });
    memory.settleDecision({
      ticker: 'SIMC',
      tradeDate: '2024-07-01',
      resolvedOn: '2024-07-08',
      reflection: 'Worked out',
    });
    memory.storeDecision({
      entryId: 'e2',
      ticker: 'SIMC',
      tradeDate: '2024-08-01',
      decisionText: 'Hold SIMC',
      recordedAt: asUtcInstant('2024-08-01T18:00:00.000Z'),
    });

    const early = memory.pastContextForBacktest({ ticker: 'SIMC', asOfTradeDate: '2024-08-05' });
    assert.match(early, /Worked out/);
    assert.doesNotMatch(early, /Hold SIMC/);
  });

  it('portfolio context distinguishes absent vs flat book', () => {
    assert.equal(renderPortfolioBlock('ABSENT', 'AAPL'), null);
    const flat = renderPortfolioBlock({ cash: 10_000, currency: 'USD', positions: [] }, 'AAPL');
    assert.ok(flat?.includes('No current position in AAPL'));
  });

  it('integrates feature fabric, revision ledger, manifest, and evidence vault', () => {
    const ingested = ingestSecFundamentalSubmissions(SIMCORP_SUBMISSION_TIMELINE);
    const fabric = createHeliosFundamentalFeatureFabric();
    const facts: FundamentalFactRecord[] = mapSecObservationsToHeliosFacts(ingested.observations).map((row) =>
      Object.freeze({ ...row, knowableAt: asUtcInstant(row.knowableAt) }),
    );
    fabric.ingestFacts(facts);

    const snapshot = fabric.snapshotAt({
      canonicalEntityId: SIMCORP_ENTITY_ID,
      evaluationTimeUtc: asUtcInstant('2024-08-15T12:00:00.000Z'),
      reportPeriod: '2024-06-30',
    });
    assert.equal(snapshot.features.revenue.supported, true);

    const binding = bindSecFilingsToAafRevisionLedger({
      cik: '0000999999',
      ticker: 'SIMC',
      filings: mapSecObservationsToAafFilingSources(ingested.observations),
    });
    assert.ok(binding.ledger.effectiveFilingIdsAt(SIMCORP_Q2_2024_10Q.filingId, '2024-10-01').length >= 1);

    const manifest = defaultTradingAgentsResearchDataManifest();
    assert.equal(manifest.entries.some((e) => e.revisionLedgerBound), true);

    const vault = new EvidenceVault(systemClock);
    const memory = new TradingAgentsDecisionMemoryStore();
    memory.storeDecision({
      entryId: 'e-native10',
      ticker: 'SIMC',
      tradeDate: '2024-08-15',
      decisionText: 'Research only',
      recordedAt: NOW,
    });
    const entry = memory.entriesSnapshot()[0]!;
    sealDecisionMemoryEntry(vault, entry);

    const pkg = packageResearchRunContext({
      subjectId: 'subj_1',
      ticker: 'SIMC',
      tradeDate: '2024-08-15',
      evaluationTimeUtc: asUtcInstant('2024-08-15T23:59:59.000Z'),
      portfolio: 'ABSENT',
      portfolioBlock: null,
      memoryStore: memory,
      asOfTradeDate: '2024-08-15',
      dataEvidenceRefs: Object.freeze(['sec-edgar:simcorp-q2']),
    });
    sealResearchContextPackage(vault, pkg);
    assert.equal(vault.count(), 2);
  });

  it('emits HELIOS_NATIVE_TRADINGAGENTS_DATA_QUALIFIED when checks pass', () => {
    const dataflow = evaluateNative10DataflowChecks({
      dateWindowDiscipline: true,
      symbolNormalization: true,
      providerFallback: true,
      macroRouting: true,
      pitSecEdgar: true,
      noPythonProductionDependency: assertNoPythonProductionDependency().length === 0,
    });
    assert.equal(dataflow.pass, true, dataflow.blockers.join('; '));

    const os10 = evaluateHeliosOs10PointInTimeFundamentalsQualification({
      noQ2BeforeFiling: true,
      q2OriginalRevenueAtBacktest: true,
      noFutureLeakQ2Window: true,
      restatementUpdatesEffectiveRevenue: true,
      restatementPreservesOriginalFacts: true,
      aafRevisionLedgerTracksAmendment: true,
      pitEffectiveFactBeforeRestatement: true,
      derivedMarginsWhenFactsSupport: true,
    });

    const result = evaluateNative10TradingAgentsDataQualification({
      dataflowPorted: dataflow.pass,
      memoryPorted: true,
      portfolioContextPorted: true,
      pitEnforced: os10.qualified,
      evidenceSealed: true,
      noPythonImportInProduction: assertNoPythonProductionDependency().length === 0,
    });

    assert.equal(result.qualified, true, result.blockers.join('; '));
    assert.equal(result.marker, HELIOS_NATIVE_TRADINGAGENTS_DATA_QUALIFIED);
  });
});
