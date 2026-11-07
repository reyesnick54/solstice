import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { UtcInstant } from '@solstice/domain';

import { LIVE_TRADING_ENABLED, MARKET_DATA_LIVE_SHADOW_ENABLED } from '@solstice/config';

import type { MarketDataFabricQualificationResult } from './md14-qualification.ts';
import { listMdWorkPackages } from './work-package-registry.ts';
import {
  HELIOS_PRODUCTION_MARKET_DATA_V1_BLOCKED,
  HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED,
} from './taxonomy.ts';

export type MarketDataReportRegenerationInput = {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly qualification: MarketDataFabricQualificationResult;
  readonly subprocessGatesOk: boolean;
};

function workPackageTable(root: string): string {
  const rows = listMdWorkPackages(root);
  const lines = [
    '| Package | Capability | Canonical owner | Qualification |',
    '|---------|------------|-----------------|----------------|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.packageId} | ${row.title} | \`${row.moduleRef}\` | ${row.status === 'IMPLEMENTED' ? 'QUALIFIED (module + test)' : 'BLOCKED'} |`,
    );
  }
  return lines.join('\n');
}

export function regenerateMarketDataQualificationReports(input: MarketDataReportRegenerationInput): void {
  const marker = input.qualification.qualified
    ? HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED
    : HELIOS_PRODUCTION_MARKET_DATA_V1_BLOCKED;
  const table = workPackageTable(input.root);
  const blockers =
    input.qualification.blockers.length === 0
      ? '_None._'
      : input.qualification.blockers.map((row) => `- ${row}`).join('\n');

  const finalReport = `# HELIOS Market Data — MD15 Current-Main Requalification Report

**Engineering marker:** \`${marker}\`

**Git SHA:** \`${input.gitSha}\`

**Evaluated at (UTC):** \`${input.evaluatedAt}\`

**Subprocess gates:** ${input.subprocessGatesOk ? 'GREEN' : 'BLOCKED'}

## Posture (unchanged)

- \`ENVIRONMENT=simulation\`
- \`MARKET_DATA_LIVE_SHADOW_ENABLED=${String(MARKET_DATA_LIVE_SHADOW_ENABLED)}\`
- \`LIVE_TRADING_ENABLED=${String(LIVE_TRADING_ENABLED)}\`
- \`LIVE_INVESTMENT_EXECUTION=false\`
- \`production_authorized=false\`

This marker means **architecture / engineering qualification**. It does **not** mean a commercial data provider is contracted or licensed.

## MD01–MD14 canonical verification

${table}

## MD14 integration harness

- **Owner:** \`packages/platform/src/helios/market-data/md14-qualification.ts\`
- **E2E pipeline:** \`e2e-pipeline.ts\` (canonical MD01–MD05 + MD12 stages)
- **Canonical probes:** \`md14-canonical-probes.ts\` (MD06, MD09, MD10, MD13 harnesses)
- **Qualification test:** \`tests/helios-md14-market-data-qualification.test.ts\`
- **Runner:** \`npm run helios:md14:qualify\`

## E2E and adversarial

- E2E pipeline ok: **${input.qualification.e2ePipelineOk}**
- Adversarial scenarios: **${input.qualification.adversarialScenariosPassed}/${input.qualification.adversarialScenariosTotal}**

## Blockers

${blockers}
`;

  const capabilityMatrix = `# Market Data Capability Matrix

**Git SHA:** \`${input.gitSha}\` · **Evaluated at (UTC):** \`${input.evaluatedAt}\`

| Package | Capability | Canonical owner | Qualification status |
|---------|------------|-----------------|----------------------|
${listMdWorkPackages(input.root)
  .map(
    (row) =>
      `| ${row.packageId} | ${row.title} | \`${row.moduleRef}\` | ${row.status === 'IMPLEMENTED' ? 'IMPLEMENTED' : 'BLOCKED'} |`,
  )
  .join('\n')}

Research features require AAF certification. Live shadow and execution remain disabled in this qualification pass.
`;

  const providerQualification = `# Market Data Provider Qualification

**Git SHA:** \`${input.gitSha}\` · **Evaluated at (UTC):** \`${input.evaluatedAt}\`

## Status ladder

1. **REGISTERED** — Provider appears in certification catalog overlay.
2. **SANDBOX_QUALIFIED** — Conformance, gap recovery, clock validation, and chaos tests pass on fixtures.
3. **READONLY_LIVE_QUALIFIED** — Sandbox checks plus credentials, contract/license, entitlement evidence, data-use policy, and **verified external connectivity**.
4. **PRODUCTION_RESEARCH_QUALIFIED** — Read-only live qualification complete for continuous research ingestion.

Fixture catalog providers remain **SANDBOX_QUALIFIED** only for this MD15 pass (\`MARKET_DATA_LIVE_SHADOW_ENABLED=false\`).

Implementation: \`packages/platform/src/helios/market-data/provider-qualification.ts\`.

## Qualification status

- MD14 fabric marker: \`${marker}\`
- Live shadow eligible without connectivity evidence: **blocked**
`;

  const resilienceReport = `# Market Data Resilience Report

**Git SHA:** \`${input.gitSha}\` · **Evaluated at (UTC):** \`${input.evaluatedAt}\`

## Canonical owners

| Area | Owner | Status |
|------|-------|--------|
| Redundant feed arbitration (MD05) | \`packages/platform/src/helios/market-data/md05/index.ts\` | IMPLEMENTED |
| Sequence recovery (MD03) | \`packages/platform/src/helios/market-data/md03/index.ts\` | IMPLEMENTED |
| Live-data resilience / chaos (MD13) | \`packages/platform/src/helios/market-data-live/md13/index.ts\` | IMPLEMENTED |

MD14 adversarial scenarios: \`${input.qualification.adversarialScenariosPassed}/${input.qualification.adversarialScenariosTotal}\` passed via \`adversarial-qualification.ts\`.
`;

  const timeIntegrityReport = `# Market Data Time Integrity Report

**Git SHA:** \`${input.gitSha}\` · **Evaluated at (UTC):** \`${input.evaluatedAt}\`

## Precision time (MD02)

Canonical owner: \`packages/platform/src/helios/market-data/md02/index.ts\`

- \`buildMarketTimeEnvelope\` distinguishes pipeline stages and computes \`knowableAt\`.
- MD14 E2E invokes MD02 for the time-envelope stage.
- Adversarial scenario \`md14_clock_skew\` rejects \`knowableAt < eventTime\`.

AAF feature certification requires \`knowableAt >= eventTime\` (\`aaf-integration.ts\`).
`;

  const base = join(input.root, 'docs/helios/market-data');
  writeFileSync(join(base, 'HELIOS_MARKET_DATA_FINAL_REPORT.md'), `${finalReport}\n`);
  writeFileSync(join(base, 'MARKET_DATA_CAPABILITY_MATRIX.md'), `${capabilityMatrix}\n`);
  writeFileSync(join(base, 'MARKET_DATA_PROVIDER_QUALIFICATION.md'), `${providerQualification}\n`);
  writeFileSync(join(base, 'MARKET_DATA_RESILIENCE_REPORT.md'), `${resilienceReport}\n`);
  writeFileSync(join(base, 'MARKET_DATA_TIME_INTEGRITY_REPORT.md'), `${timeIntegrityReport}\n`);
}
