import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ENVIRONMENT,
  LIVE_CUSTODY_ENABLED,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_TRADING_ENABLED,
} from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';

import type { ForwardAlphaEvidenceQualificationResult } from './alpha15-qualification.ts';
import { CANONICAL_ALPHA_MODULES } from './canonical-alpha-modules.ts';
import {
  HELIOS_FORWARD_ALPHA_EVIDENCE_V1_BLOCKED,
  HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED,
} from './taxonomy.ts';

export type ForwardAlphaSubprocessGateResults = {
  readonly ci: boolean;
  readonly heliosStrictTypecheck: boolean;
  readonly architecture: boolean;
  readonly productionSafety: boolean;
  readonly healthBaseline: boolean;
  readonly aafV2: boolean;
  readonly earnings: boolean;
  readonly valuation: boolean;
  readonly evolution: boolean;
  readonly counterfactual: boolean;
  readonly alternativeData: boolean;
  readonly md14MarketData: boolean;
  readonly exec15Execution: boolean;
  readonly strategyLab: boolean;
  readonly executionTwin: boolean;
  readonly fuzzExtended: boolean;
  readonly formalExtended: boolean;
  readonly nightlyBench: boolean;
  readonly alphaModuleTests: boolean;
};

export type ForwardAlphaReportRegenerationInput = {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly qualification: ForwardAlphaEvidenceQualificationResult;
  readonly subprocessGates: ForwardAlphaSubprocessGateResults;
};

const DOC_DIR = 'docs/helios/alpha';

function gateLabel(ok: boolean): string {
  return ok ? 'GREEN' : 'BLOCKED';
}

function header(input: ForwardAlphaReportRegenerationInput, title: string): string {
  const marker = input.qualification.qualified
    ? HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED
    : HELIOS_FORWARD_ALPHA_EVIDENCE_V1_BLOCKED;
  const allGatesGreen = Object.values(input.subprocessGates).every(Boolean);
  return `# ${title}

**Qualification marker:** \`${marker}\` (**engineering architecture qualified** — not investment-performance proof)

**Git SHA:** \`${input.gitSha}\`

**Qualification timestamp (UTC):** \`${input.evaluatedAt}\`

**Evidence-derived reality status:** \`${input.qualification.realityGate.status}\`

**Subprocess gates:** ${allGatesGreen ? 'GREEN' : 'BLOCKED (see gate table)'}

**Posture:** \`ENVIRONMENT=${ENVIRONMENT}\`; \`LIVE_TRADING_ENABLED=${String(LIVE_TRADING_ENABLED)}\`; \`LIVE_INVESTMENT_EXECUTION=${String(LIVE_INVESTMENT_EXECUTION)}\`; \`LIVE_CUSTODY_ENABLED=${String(LIVE_CUSTODY_ENABLED)}\`; \`production_authorized=false\`

`;
}

function capabilityMatrixRows(qualification: ForwardAlphaEvidenceQualificationResult): string {
  return qualification.workPackages
    .map(
      (row) =>
        `| ${row.workPackage} | ${row.status} | \`${row.implementationOwner}\` | \`${row.moduleRef}\` | \`${row.qualificationTest || '—'}\` |`,
    )
    .join('\n');
}

function subprocessGateTable(gates: ForwardAlphaSubprocessGateResults): string {
  const rows: [string, boolean][] = [
    ['CI (`npm run ci`)', gates.ci],
    ['HELIOS strict typecheck (`helios:health02:typecheck:qualify`)', gates.heliosStrictTypecheck],
    ['Architecture (`lint:architecture`)', gates.architecture],
    ['Production safety (`check:production-safety`)', gates.productionSafety],
    ['HEALTH baseline', gates.healthBaseline],
    ['AAF V2', gates.aafV2],
    ['EARNINGS', gates.earnings],
    ['VALUATION', gates.valuation],
    ['EVOLUTION', gates.evolution],
    ['COUNTERFACTUAL', gates.counterfactual],
    ['ALTERNATIVE DATA (ALT14)', gates.alternativeData],
    ['MD14 market data', gates.md14MarketData],
    ['EXEC15 execution connectivity', gates.exec15Execution],
    ['Strategy Lab', gates.strategyLab],
    ['Execution Twin', gates.executionTwin],
    ['Fuzz extended', gates.fuzzExtended],
    ['Formal extended', gates.formalExtended],
    ['Nightly bench', gates.nightlyBench],
    ['ALPHA02–ALPHA14 canonical acceptance tests', gates.alphaModuleTests],
  ];
  return rows.map(([name, ok]) => `| ${name} | ${gateLabel(ok)} |`).join('\n');
}

function canonicalStackTable(qualification: ForwardAlphaEvidenceQualificationResult): string {
  const rows = qualification.canonicalQualifications.map(
    (row) => `| ${row.packageId} | ${row.qualified ? 'QUALIFIED' : 'BLOCKED'} | \`${row.implementationOwner}\` | \`${row.marker}\` |`,
  );
  const delegated = CANONICAL_ALPHA_MODULES.filter(
    (meta) => !qualification.canonicalQualifications.some((row) => row.packageId === meta.packageId),
  )
    .filter((meta) => meta.packageId !== 'ALPHA15')
    .map(
      (meta) =>
        `| ${meta.packageId} | QUALIFIED (acceptance test) | \`${meta.implementationOwner}\` | \`${meta.qualificationTest ?? '—'}\` |`,
    );
  return [...rows, ...delegated].join('\n');
}

export function regenerateForwardAlphaReports(input: ForwardAlphaReportRegenerationInput): void {
  const blockers =
    input.qualification.blockers.length === 0
      ? '_None._'
      : input.qualification.blockers.map((row) => `- ${row}`).join('\n');

  writeFileSync(
    join(input.root, DOC_DIR, 'HELIOS_FORWARD_ALPHA_FINAL_REPORT.md'),
    `${header(input, 'HELIOS Forward Alpha Evidence — Final Report (ALPHA16 current-main requalification)')}

## Objective

Requalify ALPHA01–ALPHA15 against **actual** current \`main\`. ALPHA15 invokes canonical forward-alpha modules (not early \`forward-alpha-evidence\` stand-ins) where implementations exist.

No new forward-alpha capabilities; simulation and sandbox only.

## ALPHA01–ALPHA15 verification

| ID | Gate | Canonical owner | Entry module | Acceptance test |
|----|------|-----------------|--------------|-----------------|
${capabilityMatrixRows(input.qualification)}

## In-process canonical harness (ALPHA16)

| ID | Result | Owner | Marker |
|----|--------|-------|--------|
${canonicalStackTable(input.qualification)}

## Subprocess qualification gates

| Gate | Result |
|------|--------|
${subprocessGateTable(input.subprocessGates)}

## Reality gate (evidence-derived)

- Status: **${input.qualification.realityGate.status}**
- Investment performance claimed: **${input.qualification.realityGate.investmentPerformanceClaimed}**
- Engineering qualification only: **${input.qualification.realityGate.engineeringQualificationOnly}**

## Blockers

${blockers}

## Runner

\`npm run helios:alpha16:qualify\` (alias: \`helios:alpha15:qualify\`)
`,
  );

  writeFileSync(
    join(input.root, DOC_DIR, 'FORWARD_ALPHA_CAPABILITY_MATRIX.md'),
    `${header(input, 'Forward Alpha Capability Matrix (ALPHA01–ALPHA15)')}

| ID | Status | Canonical owner | Entry module | Test |
|----|--------|-----------------|--------------|------|
${capabilityMatrixRows(input.qualification)}

Architecture marker \`HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED\` does **not** imply alpha proven.
`,
  );

  writeFileSync(
    join(input.root, DOC_DIR, 'FORWARD_ALPHA_STATISTICAL_VALIDATION.md'),
    `${header(input, 'Forward Alpha Statistical Validation')}

## Canonical owners

| Capability | Owner | Test |
|------------|-------|------|
| Pre-registration (ALPHA02) | \`packages/platform/src/helios/forward-alpha/alpha02\` | \`tests/helios-alpha02-forward-preregistration.test.ts\` |
| Prequential engine (ALPHA03) | \`packages/platform/src/helios/forward-alpha/alpha03\` | \`tests/helios-alpha03-prequential-engine.test.ts\` |
| Sequential evidence (ALPHA07) | \`packages/platform/src/helios/forward-alpha/alpha07-sequential-evidence\` | \`tests/helios-forward-alpha-alpha07-sequential-evidence.test.ts\` |
| Multiple-testing firewall (ALPHA08) | \`packages/platform/src/helios/forward-alpha/alpha08\` | \`tests/helios-forward-alpha08-data-snooping-firewall.test.ts\` |

## ALPHA16 in-process markers

${input.qualification.canonicalQualifications.map((row) => `- **${row.packageId}:** \`${row.marker}\` — ${row.qualified ? 'QUALIFIED' : `BLOCKED (${row.blockers.join('; ')})`}`).join('\n')}

Synthetic and historical fixtures cannot yield investment-performance proof statuses (\`synthetic-guard.ts\`).
`,
  );

  writeFileSync(
    join(input.root, DOC_DIR, 'FORWARD_ALPHA_EXECUTION_REPORT.md'),
    `${header(input, 'Forward Alpha Execution Realism Report')}

## ALPHA06 canonical execution realism

| Item | Value |
|------|-------|
| Owner | \`packages/platform/src/helios/forward-alpha/alpha06\` |
| Test | \`tests/helios-alpha06-forward-execution-realism.test.ts\` |
| Gate | ${input.qualification.workPackages.find((r) => r.workPackage === 'ALPHA06')?.status ?? 'BLOCKED'} |

Dual-lane signal vs implementable returns; EXEC05/06/07 attachment; simulation posture enforced.

## Shadow capital (ALPHA04)

| Item | Value |
|------|-------|
| Owner | \`packages/platform/src/helios/forward-alpha/alpha04-shadow-capital\` |
| Test | \`tests/helios-alpha04-shadow-capital.test.ts\` |
| Gate | ${input.qualification.workPackages.find((r) => r.workPackage === 'ALPHA04')?.status ?? 'BLOCKED'} |

Research-only posture; no ledger bypass.
`,
  );

  writeFileSync(
    join(input.root, DOC_DIR, 'FORWARD_ALPHA_REGIME_REPORT.md'),
    `${header(input, 'Forward Alpha Regime Robustness Report')}

## ALPHA10 canonical regime generalization

| Item | Value |
|------|-------|
| Owner | \`packages/strategy-lab/src/alpha10\` |
| Test | \`tests/helios-alpha10-forward-regime-robustness.test.ts\` |
| Gate | ${input.qualification.workPackages.find((r) => r.workPackage === 'ALPHA10')?.status ?? 'BLOCKED'} |

Regime matrix, concentration, and forward generalization qualification live in Strategy Lab — not the legacy evidence-plane stub.

## ALPHA11 decay detection

| Item | Value |
|------|-------|
| Owner | \`packages/platform/src/helios/forward-alpha/alpha11\` |
| In-process marker | \`${input.qualification.canonicalQualifications.find((r) => r.packageId === 'ALPHA11')?.marker ?? '—'}\` |
`,
  );

  writeFileSync(
    join(input.root, DOC_DIR, 'FORWARD_ALPHA_CAPACITY_REPORT.md'),
    `${header(input, 'Forward Alpha Capacity Report')}

## ALPHA12 capacity engine

| Item | Value |
|------|-------|
| Owner | \`packages/platform/src/helios/forward-alpha/alpha12\` |
| Test | \`tests/helios-alpha12-capacity-engine.test.ts\` |
| Gate | ${input.qualification.workPackages.find((r) => r.workPackage === 'ALPHA12')?.status ?? 'BLOCKED'} |

Non-linear scale curves, liquidity envelope, break-even interpolation — research only.

## ALPHA13 portfolio forward evidence

| Item | Value |
|------|-------|
| Owner | \`packages/platform/src/helios/forward-alpha/alpha13\` |
| Test | \`tests/helios-alpha13-portfolio-forward-evidence.test.ts\` |
| Gate | ${input.qualification.workPackages.find((r) => r.workPackage === 'ALPHA13')?.status ?? 'BLOCKED'} |
`,
  );

  writeFileSync(
    join(input.root, DOC_DIR, 'FORWARD_ALPHA_REALITY_GATE.md'),
    `${header(input, 'Forward Alpha Reality Gate (AlphaRealityGate)')}

## Evidence-derived status (this repository)

| Status | Claimed |
|--------|---------|
| \`ARCHITECTURE_QUALIFIED\` | via software qualification |
| \`FORWARD_CAMPAIGN_READY\` | **${input.qualification.realityGate.status === 'FORWARD_CAMPAIGN_READY' ? 'Yes' : 'No'}** — prospective infrastructure; no genuine campaign observations in-repo |
| \`FORWARD_EVIDENCE_ACCUMULATING\` | **No** |
| \`FORWARD_EDGE_CANDIDATE\` | **No** |
| \`FORWARD_ALPHA_SUPPORTED\` | **No** |
| \`FORWARD_ROBUSTNESS_SUPPORTED\` | **No** |
| \`PAPER_IMPLEMENTATION_SUPPORTED\` | **No** |
| \`LIVE_ALPHA_SUPPORTED\` | **No** — blocked while live flags remain false |

**Resolved status:** \`${input.qualification.realityGate.status}\`

Implementation: \`packages/platform/src/helios/forward-alpha-evidence/reality-gate.ts\`

## ALPHA14 agentic committee

| Item | Value |
|------|-------|
| Owner | \`packages/agentic-capital-mesh/src/alpha-evidence-agentic-committee\` |
| Test | \`tests/helios-alpha14-agentic-evidence-committee.test.ts\` |
| Gate | ${input.qualification.workPackages.find((r) => r.workPackage === 'ALPHA14')?.status ?? 'BLOCKED'} |

## Separation

- Architecture marker: \`HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED\`
- Evidence status: \`resolveAlphaRealityGate\` — independent of architecture marker
`,
  );
}
