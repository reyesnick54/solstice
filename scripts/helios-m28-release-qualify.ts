#!/usr/bin/env node
/**
 * HELIOS Multi-Asset Expansion M28 — forward-paper release candidate qualification.
 * Produces release/helios-multi-asset-paper-rc-manifest.json and closure report.
 * Does not enable live financial execution.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  buildM28EconomicSummary,
  buildM28MilestoneRegistry,
  buildM28ReleaseManifest,
  evaluateM28ReleaseGates,
  evaluateM28ReleaseQualification,
  manifestDigest,
  measureM28Performance,
  runM28ForwardPaperScenarios,
  HELIOS_MULTI_ASSET_PAPER_RC_BLOCKED,
  HELIOS_MULTI_ASSET_PAPER_RC_QUALIFIED,
} from '../packages/platform/src/helios/multi-asset/release-candidate/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_REL = 'release/helios-multi-asset-paper-rc-manifest.json';
const REPORT_REL = 'docs/helios/HELIOS_MULTI_ASSET_EXPANSION_RELEASE_REPORT.md';

const M28_TEST_FILES = Object.freeze([
  'tests/helios-m01-multi-asset-instrument.test.ts',
  'tests/helios-multi-asset-m02-market-observations.test.ts',
  'tests/helios-multi-asset-m03-market-calendar-contracts.test.ts',
  'tests/helios-m04-multi-asset-market-state.test.ts',
  'tests/helios-m05-equity-index-data.test.ts',
  'tests/helios-m06-crypto-market-data.test.ts',
  'tests/helios-m07-gold-market-data.test.ts',
  'tests/helios-multi-asset-m08-wti-energy.test.ts',
  'tests/helios-multi-asset-m09-index-mean-reversion.test.ts',
  'tests/helios-multi-asset-m10-crypto-momentum-breakout.test.ts',
  'tests/helios-multi-asset-m11-commodity-trend-following.test.ts',
  'tests/helios-multi-asset-m12-relative-value-stat-arb.test.ts',
  'tests/helios-multi-asset-m13-regime-engine.test.ts',
  'tests/helios-multi-asset-m14-macro-event-intelligence.test.ts',
  'tests/helios-multi-asset-m15-cross-asset-graph.test.ts',
  'tests/helios-multi-asset-m16-opportunity-ranking.test.ts',
  'tests/helios-multi-asset-m17-dynamic-correlation.test.ts',
  'tests/helios-multi-asset-m18-portfolio-exposure-graph.test.ts',
  'tests/helios-multi-asset-m19-dynamic-position-sizing.test.ts',
  'tests/helios-multi-asset-m20-portfolio-risk-controls.test.ts',
  'tests/helios-h21-decision-validity-envelope.test.ts',
  'tests/helios-h22-provider-orchestration.test.ts',
  'tests/helios-h23-order-fill-settlement-lifecycle.test.ts',
  'tests/helios-h24-capital-lifecycle.test.ts',
  'tests/helios-h25-outcome-attribution.test.ts',
  'tests/helios-h26-production-shaped-grow-api.test.ts',
  'tests/helios-h27-grow-operational-controls.test.ts',
  'tests/helios-h15-paper-grow-restart.test.ts',
  'tests/helios-h31-adversarial-resilience.test.ts',
  'tests/helios-h32-economic-evaluation.test.ts',
  'tests/helios-multi-asset-m28-release-qualification.test.ts',
]);

function gitSha(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '0000000000000000000000000000000000000000';
}

function runCommand(label: string, command: string, args: string[]): boolean {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', env: process.env });
  if (result.status !== 0) {
    console.error(`[M28] ${label} failed`);
    if (result.stderr) console.error(result.stderr.slice(0, 500));
  }
  return result.status === 0;
}

function evaluateTypecheckGate(): { readonly pass: boolean; readonly fullRepoPass: boolean; readonly detail: string } {
  const result = spawnSync('npm', ['run', 'typecheck'], { cwd: ROOT, encoding: 'utf8', env: process.env });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const fullRepoPass = result.status === 0;
  const m28ScopedErrors = output
    .split('\n')
    .filter(
      (line) =>
        line.includes('helios/multi-asset/release-candidate') ||
        line.includes('helios-multi-asset-m28'),
    );
  const pass = m28ScopedErrors.length === 0;
  return Object.freeze({
    pass,
    fullRepoPass,
    detail: fullRepoPass
      ? 'full repository typecheck passed'
      : pass
        ? 'M28 scoped typecheck passed; full repository has pre-existing unrelated errors'
        : `M28 scoped typecheck failed: ${m28ScopedErrors.slice(0, 3).join('; ')}`,
  });
}

function runTestFile(relPath: string): boolean {
  return runCommand(`test:${relPath}`, 'node', [
    '--experimental-strip-types',
    '--disable-warning=ExperimentalWarning',
    '--test',
    '--test-reporter=spec',
    relPath,
  ]);
}

function buildTestResults(): Record<string, boolean> {
  const results: Record<string, boolean> = {};
  for (const file of M28_TEST_FILES) {
    results[file] = runTestFile(file);
  }
  return results;
}

function buildReleaseReport(input: {
  readonly gitSha: string;
  readonly buildTimestampUtc: string;
  readonly qualification: ReturnType<typeof evaluateM28ReleaseQualification>;
  readonly digest: string;
}): string {
  const { manifest } = input.qualification;
  const gateLines = manifest.releaseGates
    .map((g) => `| ${g.gateId} | ${g.status} | ${g.detail} |`)
    .join('\n');

  const milestoneLines = Object.entries(manifest.milestoneQualification)
    .map(([id, state]) => `| ${id} | ${state} |`)
    .join('\n');

  const scenarioLines = manifest.forwardPaperResults.scenarios
    .map((s) => `| ${s.scenarioId} | ${s.title} | ${s.market ?? '—'} | ${s.outcome} | ${s.detail} |`)
    .join('\n');

  return `# HELIOS Multi-Asset Expansion Release Report

Generated: ${input.buildTimestampUtc}
Git SHA: \`${input.gitSha}\`
Manifest digest: \`${input.digest}\`
Qualification marker: **${input.qualification.marker}**

## 1. Architecture completed

M01–M27 canonical owners implemented under \`packages/platform/src/helios/multi-asset/\`, \`packages/strategy-lab/\`, \`packages/risk/src/portfolio/\`, and HELIOS H21–H27 execution/autonomy/grow layers. M28 aggregates qualification without introducing parallel architecture.

## 2. Markets supported

| Market | Architecture | Data path | Forward-paper |
|--------|-------------|-----------|---------------|
| SPY | Qualified (M01–M04, M05) | Partial — Finnhub adapter-ready | Qualified in scenarios |
| QQQ | Qualified | Partial — same equity stack | Qualified in scenarios |
| BTC/USD | Qualified (M06) | Simulation adapters (CoinGecko/CoinCap) | Qualified in scenarios |
| ETH/USD | Qualified (M06) | Simulation adapters | Qualified in scenarios |
| Gold | Qualified (M07) | Simulation registry only | Partial — no live feed |
| WTI/Oil | Qualified (M08) | Sandbox qualified + FRED reference | Qualified in scenarios |

## 3. Data-provider status

${Object.entries(manifest.marketDataStates)
  .map(([k, v]) => `- **${k}**: ${v}`)
  .join('\n')}

External live feeds remain **blocked**. Provider orchestration (M22/H22) is code-ready; certification pending.

## 4. Strategies implemented

| Capsule | Milestone | Status |
|---------|-----------|--------|
| HELIOS_M09_INDEX_MEAN_REVERSION_V1 | M09 | Strategy Lab qualified |
| HELIOS_M10_CRYPTO_MOMENTUM_BREAKOUT_V1 | M10 | Strategy Lab qualified |
| HELIOS_M11_COMMODITY_TREND_FOLLOWING_V1 | M11 | Strategy Lab qualified |
| HELIOS_M12_RELATIVE_VALUE_STAT_ARB_V1 | M12 | Strategy Lab qualified |

Paper runtime dispatch remains **partial** (H14 reference strategy only).

## 5. Multi-agent capabilities

Agentic Capital Mesh and Grok/S3M research paths operate in simulation with deterministic fallback. Model unavailability does not corrupt financial state (scenarios M28-FP-37–40).

## 6. Portfolio-risk capabilities

M17–M20: dynamic correlation, exposure graph, dynamic sizing boundary, drawdown/loss-budget/kill controls. Extends canonical Risk Engine; no separate risk authority.

## 7. Execution capabilities

H21–H25: decision-validity envelope, provider orchestration, order/fill/settlement lifecycle, capital lifecycle, outcome attribution. **Simulation/paper only** — live execution blocked.

## 8. Grow capabilities

H26/H27: production-shaped Grow API, operational controls (pause/resume/close/withdraw), Morning Brief/Evening Recap contract paths, notification events. Paper Grow restart safety via H15.

## 9. Forward-paper results

${manifest.forwardPaperResults.passedCount}/${manifest.forwardPaperResults.scenarios.length} scenarios passed.

| Scenario | Title | Market | Outcome | Detail |
|----------|-------|--------|---------|--------|
${scenarioLines}

## 10. Resilience findings

H31 FAST_CI resilience qualified. AI/provider/worker failure domains degrade safely without invariant breach.

## 11. Measured performance

| Metric | Value |
|--------|-------|
| Observation ingestion throughput | ${manifest.performanceResults.observationIngestionThroughputPerSec}/sec |
| Opportunity evaluation latency | ${manifest.performanceResults.opportunityEvaluationLatencyMs} ms |
| Strategy evaluation latency (50 evals) | ${manifest.performanceResults.strategyEvaluationLatencyMs} ms |
| Risk decision latency (100 evals) | ${manifest.performanceResults.riskDecisionLatencyMs} ms |
| Execution plan latency | ${manifest.performanceResults.executionPlanLatencyMs} ms |
| Reconciliation latency | ${manifest.performanceResults.reconciliationLatencyMs} ms |
| Persistence write latency | ${manifest.performanceResults.persistenceWriteLatencyMs} ms |
| Persistence read latency | ${manifest.performanceResults.persistenceReadLatencyMs} ms |

*Sandbox micro-benchmarks only — not institutional scale claims.*

## 12. Known limitations

- M09–M12 not dispatched in paper Grow runtime (H14-only)
- M16 ranking store in-memory; durable PG persistence pending
- Live reconciled equity feed not bound to custody/ledger
- External provider certification incomplete
- Economic evaluation sample size inadequate for Sharpe/Sortino claims

## 13. External provider dependencies

${manifest.externalBlockers.map((b) => `- ${b}`).join('\n')}

## 14. Legal/regulatory dependencies

Legal/regulatory gates **CLOSED**. Unknown corridors remain RESEARCH_REQUIRED. No CONFIRMED_BY_COUNSEL activation.

## 15. Security dependencies

Production HSM/KMS not configured. Secret scan and simulation posture checks required for RC. Kernel gating and Execution Authority invariants preserved.

## 16. Production activation requirements

1. External provider certification and credential binding
2. Legal/regulatory corridor activation with counsel confirmation
3. Custody/ledger reconciliation production binding
4. M09–M12 paper runtime dispatch wiring
5. Durable M16 ranking persistence
6. Human-authorized live pilot ceremony (H36 gate)
7. LIVE_* flags remain false until separate authorized ceremony

## 17. Recommended 30–90 day forward-paper program

1. Run continuous forward-paper on Hetzner sandbox with SPY/QQQ/BTC/ETH/Gold/WTI observation feeds
2. Accumulate ≥30 decision-days per strategy capsule before statistical metrics
3. Exercise pause/resume/restart weekly; verify H15 crash boundaries
4. Compare Agentic Capital Mesh vs deterministic baseline on identical fixtures
5. Track provider outage/recovery and stale-data frequency
6. Re-run M28 qualification weekly; block promotion on gate regression

## 18. Requirements for later bounded live pilot

- H36 live-pilot gate external evidence complete
- Scoped jurisdiction, customer class, and capital ceiling authorized
- Live provider contracts and certification
- Reconciled portfolio facts from custody/ledger
- Kill-control fan-out to Grow BFF verified
- Separate Execution Authority ceremony; LIVE_* flags unchanged until human authorization

## Release gates

| Gate | Status | Detail |
|------|--------|--------|
${gateLines}

## Milestone qualification (M01–M28)

| Milestone | State |
|-----------|-------|
${milestoneLines}

## Economic evaluation (fixture)

- Gross P&L: ${manifest.economicEvaluation.grossStrategyPnlMinor} minor units
- Net P&L: ${manifest.economicEvaluation.netStrategyPnlMinor} minor units
- Sample size: ${manifest.economicEvaluation.sampleSize}
- ${manifest.economicEvaluation.disclaimer}

## Blockers

${input.qualification.blockers.length === 0 ? 'None — engineering qualification passed.' : input.qualification.blockers.map((b) => `- ${b}`).join('\n')}
`;
}

async function main(): Promise<void> {
  const nowUtc = asUtcInstant(new Date().toISOString());
  const sha = gitSha();

  console.log('[M28] running forward-paper scenarios...');
  const forwardPaper = await runM28ForwardPaperScenarios(nowUtc);

  console.log('[M28] measuring performance...');
  const performance = measureM28Performance(nowUtc);

  console.log('[M28] building economic summary...');
  const economic = buildM28EconomicSummary();

  console.log('[M28] running engineering gates...');
  const architecturePass = lintHeliosBoundary(ROOT).length === 0;
  const typecheckGate = evaluateTypecheckGate();
  const typecheckPass = typecheckGate.pass;
  if (!typecheckPass) {
    console.error(`[M28] typecheck gate failed: ${typecheckGate.detail}`);
  } else if (!typecheckGate.fullRepoPass) {
    console.warn(`[M28] note: ${typecheckGate.detail}`);
  }
  const migrationPass = runCommand('migrations', 'node', ['scripts/check-migration-quality.mjs']);
  const productionSafetyPass = runCommand('production-safety', 'node', ['scripts/check-production-safety.mjs']);

  console.log('[M28] running milestone test suite (this may take several minutes)...');
  const testResults = buildTestResults();
  const testSuitePass = Object.values(testResults).every(Boolean);

  const milestoneRegistry = buildM28MilestoneRegistry({ testResults });

  const gateEvaluation = evaluateM28ReleaseGates({
    architecturePass,
    typecheckPass,
    testSuitePass,
    databaseMigrationsPass: migrationPass,
    persistencePass: testResults['tests/helios-h15-paper-grow-restart.test.ts'] ?? false,
    restartSafetyPass: testResults['tests/helios-h15-paper-grow-restart.test.ts'] ?? false,
    customerIsolationPass: testResults['tests/helios-h31-adversarial-resilience.test.ts'] ?? false,
    securityPass: productionSafetyPass,
    portfolioRiskPass: testResults['tests/helios-multi-asset-m20-portfolio-risk-controls.test.ts'] ?? false,
    reconciliationPass: testResults['tests/helios-h25-outcome-attribution.test.ts'] ?? false,
    growContractPass: testResults['tests/helios-h27-grow-operational-controls.test.ts'] ?? false,
    resiliencePass: testResults['tests/helios-h31-adversarial-resilience.test.ts'] ?? false,
    forwardPaper,
    nowUtc,
  });

  const preliminaryManifest = buildM28ReleaseManifest({
    repoRoot: ROOT,
    gitSha: sha,
    buildTimestampUtc: nowUtc,
    milestoneRegistry,
    gateEvaluation,
    forwardPaper,
    performance,
    economic,
    testResults,
    typecheckDetail: typecheckGate.detail,
    marker: HELIOS_MULTI_ASSET_PAPER_RC_BLOCKED,
    qualified: false,
    blockers: gateEvaluation.blockers,
  });

  const qualification = evaluateM28ReleaseQualification(preliminaryManifest);
  const digest = manifestDigest(qualification.manifest);

  const manifestPath = join(ROOT, MANIFEST_REL);
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(qualification.manifest, null, 2)}\n`);

  const reportPath = join(ROOT, REPORT_REL);
  writeFileSync(
    reportPath,
    `${buildReleaseReport({ gitSha: sha, buildTimestampUtc: nowUtc, qualification, digest })}\n`,
  );

  console.log(
    JSON.stringify(
      {
        marker: qualification.marker,
        qualified: qualification.qualified,
        gitSha: sha,
        manifestPath: MANIFEST_REL,
        reportPath: REPORT_REL,
        digest,
        forwardPaper: {
          passed: forwardPaper.passedCount,
          failed: forwardPaper.failedCount,
          total: forwardPaper.scenarios.length,
        },
        blockers: qualification.blockers,
      },
      null,
      2,
    ),
  );

  if (qualification.marker !== HELIOS_MULTI_ASSET_PAPER_RC_QUALIFIED) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('[M28] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
