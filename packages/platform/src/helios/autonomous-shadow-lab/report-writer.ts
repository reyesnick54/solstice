import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ENVIRONMENT,
  LIVE_CUSTODY_ENABLED,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_TRADING_ENABLED,
} from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';

import type { AutonomousShadowLabQualificationResult } from './alpha25-qualification.ts';
import { SHADOW_LAB_CHAOS_SCENARIOS, SHADOW_LAB_LONG_RUN_STEPS } from './taxonomy.ts';
import {
  HELIOS_AUTONOMOUS_SHADOW_LAB_V1_BLOCKED,
  HELIOS_AUTONOMOUS_SHADOW_LAB_V1_QUALIFIED,
} from './taxonomy.ts';

export type ShadowLabSubprocessGateResults = {
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
  readonly exec16Execution: boolean;
  readonly alpha16Prerequisite: boolean;
  readonly strategyLab: boolean;
  readonly executionTwin: boolean;
  readonly fuzzExtended: boolean;
  readonly formalExtended: boolean;
  readonly nightlyBench: boolean;
  readonly alpha25Acceptance: boolean;
};

export type ShadowLabReportRegenerationInput = {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly qualification: AutonomousShadowLabQualificationResult;
  readonly subprocessGates: ShadowLabSubprocessGateResults;
};

const DOC_DIR = 'docs/helios/alpha';

function gateLabel(ok: boolean): string {
  return ok ? 'GREEN' : 'BLOCKED';
}

function header(input: ShadowLabReportRegenerationInput, title: string): string {
  const marker = input.qualification.qualified
    ? HELIOS_AUTONOMOUS_SHADOW_LAB_V1_QUALIFIED
    : HELIOS_AUTONOMOUS_SHADOW_LAB_V1_BLOCKED;
  const allGatesGreen = Object.values(input.subprocessGates).every(Boolean);
  return `# ${title}

**Qualification marker:** \`${marker}\` (**shadow lab architecture qualified** — not investment-performance proof)

**Git SHA:** \`${input.gitSha}\`

**Qualification timestamp (UTC):** \`${input.evaluatedAt}\`

**AlphaRealityGate status:** \`${input.qualification.realityGate.alphaRealityStatus}\`

**Subprocess gates:** ${allGatesGreen ? 'GREEN' : 'BLOCKED (see gate table)'}

**Posture:** \`ENVIRONMENT=${ENVIRONMENT}\`; \`LIVE_TRADING_ENABLED=${String(LIVE_TRADING_ENABLED)}\`; \`LIVE_INVESTMENT_EXECUTION=${String(LIVE_INVESTMENT_EXECUTION)}\`; \`LIVE_CUSTODY_ENABLED=${String(LIVE_CUSTODY_ENABLED)}\`; \`production_authorized=false\`

`;
}

function capabilityMatrixRows(qualification: AutonomousShadowLabQualificationResult): string {
  return qualification.workPackages
    .map(
      (row) =>
        `| ${row.workPackage} | ${row.status} | \`${row.implementationOwner}\` | \`${row.moduleRef}\` | \`${row.qualificationTest}\` |`,
    )
    .join('\n');
}

function canonicalStackTable(qualification: AutonomousShadowLabQualificationResult): string {
  return qualification.canonicalQualifications
    .map(
      (row) =>
        `| ${row.packageId} | ${row.qualified ? 'QUALIFIED' : 'BLOCKED'} | \`${row.implementationOwner}\` | \`${row.marker}\` |`,
    )
    .join('\n');
}

function subprocessGateTable(gates: ShadowLabSubprocessGateResults): string {
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
    ['EXEC16 execution connectivity', gates.exec16Execution],
    ['ALPHA16 prerequisite (ALPHA15 acceptance)', gates.alpha16Prerequisite],
    ['Strategy Lab', gates.strategyLab],
    ['Execution Twin', gates.executionTwin],
    ['Fuzz extended', gates.fuzzExtended],
    ['Formal extended', gates.formalExtended],
    ['Nightly bench', gates.nightlyBench],
    ['ALPHA25 acceptance test', gates.alpha25Acceptance],
  ];
  return rows.map(([name, ok]) => `| ${name} | ${gateLabel(ok)} |`).join('\n');
}

export function regenerateShadowLabReports(input: ShadowLabReportRegenerationInput): void {
  const blockers =
    input.qualification.blockers.length === 0
      ? '_None._'
      : input.qualification.blockers.map((row) => `- ${row}`).join('\n');

  writeFileSync(
    join(input.root, DOC_DIR, 'HELIOS_AUTONOMOUS_SHADOW_LAB_FINAL_REPORT.md'),
    `${header(input, 'HELIOS Autonomous Shadow Investment Laboratory — Final Report (ALPHA26 current-main requalification)')}

## Objective

Final **current-main** qualification of the HELIOS autonomous shadow investment laboratory (ALPHA16–ALPHA25). Orchestration invokes **canonical** forward-alpha and strategy-lab modules — not autonomous-shadow-lab stubs.

\`HELIOS_AUTONOMOUS_SHADOW_LAB_V1_QUALIFIED\` means the **shadow lab architecture is qualified**. It does **not** mean \`FORWARD_ALPHA_SUPPORTED\` unless genuine prospective observations separately satisfy **AlphaRealityGate**.

## ALPHA16–ALPHA25 verification

| ID | Gate | Canonical owner | Entry module | Acceptance test |
|----|------|-----------------|--------------|-----------------|
${capabilityMatrixRows(input.qualification)}

## In-process canonical harness (ALPHA26)

| ID | Result | Owner | Marker |
|----|--------|-------|--------|
${canonicalStackTable(input.qualification)}

## Subprocess qualification gates

| Gate | Result |
|------|--------|
${subprocessGateTable(input.subprocessGates)}

## Long-run harness (synthetic)

| Metric | Value |
|--------|-------|
| Steps | ${input.qualification.longRun.steps.length} / ${SHADOW_LAB_LONG_RUN_STEPS.length} |
| All steps OK | ${input.qualification.longRun.allStepsOk} |
| Evidence chain intact | ${input.qualification.longRun.evidenceChainIntact} |
| Demoted strategy | ${input.qualification.longRun.demotedStrategyId ?? '—'} |

## Reality gate

| Claim | Allowed from harness? |
|-------|------------------------|
| \`AUTONOMOUS_SHADOW_LAB_ARCHITECTURE_QUALIFIED\` | **Yes** |
| \`FORWARD_ALPHA_SUPPORTED\` | **No** |
| Resolved AlphaRealityGate status | **${input.qualification.realityGate.alphaRealityStatus}** |

Forward alpha supported claimed: **${input.qualification.realityGate.forwardAlphaSupportedClaimed}**

## Blockers

${blockers}

## Runner

\`npm run helios:alpha26:qualify\` (alias: \`helios:alpha25:qualify\`)
`,
  );

  writeFileSync(
    join(input.root, DOC_DIR, 'SHADOW_LAB_CAPABILITY_MATRIX.md'),
    `${header(input, 'Shadow Lab Capability Matrix (ALPHA16–ALPHA25)')}

| Work package | Gate status | Customer money | Live execution | Qualified by |
|--------------|-------------|----------------|----------------|--------------|
${input.qualification.workPackages
  .map((row) => {
    const canon = input.qualification.canonicalQualifications.find((c) => c.packageId === row.workPackage);
    const marker = canon?.marker ?? '—';
    return `| ${row.workPackage} | ${row.status} (\`${marker}\`) | No | No | \`${row.qualificationTest}\` |`;
  })
  .join('\n')}
| ALPHA25 | ${input.qualification.qualified ? 'QUALIFIED' : 'BLOCKED'} | No | No | Subprocess gate bundle |

**Posture (required):** live flags and \`production_authorized\` remain false.
`,
  );

  writeFileSync(
    join(input.root, DOC_DIR, 'SHADOW_LAB_RESILIENCE_REPORT.md'),
    `${header(input, 'Shadow Lab Resilience Report')}

Chaos scenarios in \`chaos/resilience-harness.ts\` (synthetic, in-memory).

| Scenario | Recovered | History rewrite |
|----------|-----------|-----------------|
${input.qualification.chaos.scenarios
  .map((row) => `| ${row.scenario} | ${row.recovered} | ${row.historyRewritten} |`)
  .join('\n')}

**Catalog size:** ${SHADOW_LAB_CHAOS_SCENARIOS.length} scenarios.

| Aggregate | Value |
|-----------|-------|
| allRecovered | ${input.qualification.chaos.allRecovered} |
| anyHistoryRewritten | ${input.qualification.chaos.anyHistoryRewritten} |
`,
  );

  writeFileSync(
    join(input.root, DOC_DIR, 'SHADOW_LAB_OPERATIONS_REPORT.md'),
    `${header(input, 'Shadow Lab Operations Report')}

## Canonical module owners (current-main)

| ID | Owner | In-process marker |
|----|-------|-------------------|
${canonicalStackTable(input.qualification)}

## Control room (ALPHA22)

Read-only control room and engineering SLOs: \`packages/platform/src/helios/forward-alpha/alpha22-shadow-control-room\`. Live execution paths remain blocked.

## Reports (ALPHA24)

Daily and weekly forward research books: \`packages/platform/src/helios/forward-alpha/alpha24\`.

## Demotion (ALPHA23)

Automatic demotion: \`packages/platform/src/helios/forward-alpha/alpha23\`.

## Qualification commands

\`\`\`bash
npm run helios:alpha26:qualify
npm run helios:alpha25:qualify:fast   # skip subprocess CI
\`\`\`
`,
  );

  writeFileSync(
    join(input.root, DOC_DIR, 'SHADOW_LAB_EVIDENCE_INTEGRITY_REPORT.md'),
    `${header(input, 'Shadow Lab Evidence Integrity Report')}

## Sealed decision chain

Hash-chained decisions in \`simulation/evidence-chain.ts\`; long-run qualification chain intact: **${input.qualification.longRun.evidenceChainIntact}**.

Duplicate decision ids: **${input.qualification.longRun.duplicateDecisionIds.length === 0 ? 'none' : input.qualification.longRun.duplicateDecisionIds.join(', ')}**

## AlphaRealityGate (evidence-derived)

| Status | Value |
|--------|-------|
| Resolved status | \`${input.qualification.realityGate.alphaRealityStatus}\` |
| Architecture qualified (harness) | ${input.qualification.realityGate.architectureQualified} |
| FORWARD_ALPHA_SUPPORTED claimed | ${input.qualification.realityGate.forwardAlphaSupportedClaimed} |

Synthetic harness qualification may emit **\`AUTONOMOUS_SHADOW_LAB_ARCHITECTURE_QUALIFIED\`** only. Expected simulation status: **\`FORWARD_CAMPAIGN_READY\`** unless genuine prospective evidence exists.

Implementation: \`packages/platform/src/helios/forward-alpha-evidence/reality-gate.ts\`
`,
  );
}
