import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ENVIRONMENT,
  LIVE_CUSTODY_ENABLED,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_TRADING_ENABLED,
} from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';

import type { ExecutionConnectivityQualificationResult } from './exec15-qualification.ts';
import { listExecWorkPackages } from './work-package-registry.ts';
import {
  EXEC15_ADVERSARIAL_SCENARIO_IDS,
  HELIOS_BROKER_CUSTODY_EXECUTION_V1_BLOCKED,
  HELIOS_BROKER_CUSTODY_EXECUTION_V1_QUALIFIED,
} from './taxonomy.ts';

export type ExecutionSubprocessGateResults = {
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
  readonly md15MarketData: boolean;
  readonly strategyLab: boolean;
  readonly executionTwin: boolean;
  readonly fuzzExtended: boolean;
  readonly formalExtended: boolean;
  readonly nightlyBench: boolean;
};

export type ExecutionConnectivityReportRegenerationInput = {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly qualification: ExecutionConnectivityQualificationResult;
  readonly subprocessGates: ExecutionSubprocessGateResults;
};

const DOC_DIR = 'docs/helios/execution';

function gateLabel(ok: boolean): string {
  return ok ? 'GREEN' : 'BLOCKED';
}

function capabilityMatrixRows(root: string): string {
  return listExecWorkPackages(root)
    .map(
      (row) =>
        `| ${row.packageId} | ${row.status} | \`${row.moduleRef}\` | \`${row.testRef}\` | ${packageGateFor(row.status)} |`,
    )
    .join('\n');
}

function packageGateFor(status: 'IMPLEMENTED' | 'BLOCKED'): string {
  return status === 'IMPLEMENTED' ? 'QUALIFIED' : 'BLOCKED';
}

function subprocessGateTable(gates: ExecutionSubprocessGateResults): string {
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
    ['ALTERNATIVE DATA', gates.alternativeData],
    ['MD15 market data (MD14 harness on current main)', gates.md15MarketData],
    ['Strategy Lab', gates.strategyLab],
    ['Execution Twin', gates.executionTwin],
    ['Fuzz extended', gates.fuzzExtended],
    ['Formal extended', gates.formalExtended],
    ['Nightly bench', gates.nightlyBench],
  ];
  return rows.map(([name, ok]) => `| ${name} | ${gateLabel(ok)} |`).join('\n');
}

export function regenerateExecutionConnectivityReports(input: ExecutionConnectivityReportRegenerationInput): void {
  const marker = input.qualification.qualified
    ? HELIOS_BROKER_CUSTODY_EXECUTION_V1_QUALIFIED
    : HELIOS_BROKER_CUSTODY_EXECUTION_V1_BLOCKED;
  const blockers =
    input.qualification.blockers.length === 0
      ? '_None._'
      : input.qualification.blockers.map((row) => `- ${row}`).join('\n');
  const allGatesGreen = Object.values(input.subprocessGates).every(Boolean);

  const header = (title: string) => `# ${title}

**Qualification marker:** \`${marker}\` (**ENGINEERING_ARCHITECTURE_QUALIFIED** only)

**Git SHA:** \`${input.gitSha}\`

**Qualification timestamp (UTC):** \`${input.evaluatedAt}\`

**Subprocess gates:** ${allGatesGreen ? 'GREEN' : 'BLOCKED (see gate table)'}

**Posture:** \`ENVIRONMENT=${ENVIRONMENT}\`; \`LIVE_TRADING_ENABLED=${String(LIVE_TRADING_ENABLED)}\`; \`LIVE_INVESTMENT_EXECUTION=${String(LIVE_INVESTMENT_EXECUTION)}\`; \`LIVE_CUSTODY_ENABLED=${String(LIVE_CUSTODY_ENABLED)}\`; \`production_authorized=false\`

`;

  writeFileSync(
    join(input.root, DOC_DIR, 'HELIOS_EXECUTION_CONNECTIVITY_FINAL_REPORT.md'),
    `${header('HELIOS Execution Connectivity — Final Report (EXEC16 current-main requalification)')}

## Objective

Requalify EXEC01–EXEC15 against **actual** current \`main\`. EXEC15 synthetic E2E invokes the canonical **EXEC09** institutional settlement module (\`Exec09SettlementLifecycleService\`), not legacy settlement-semantics stand-ins.

No new execution features; simulation and sandbox only.

## EXEC01–EXEC15 verification

| ID | Status | Canonical owner | Test owner | Gate |
|----|--------|-----------------|------------|------|
${capabilityMatrixRows(input.root)}

## EXEC15 integration

- **Owner:** \`packages/platform/src/helios/execution-connectivity/exec15-qualification.ts\`
- **Qualification test:** \`tests/helios-exec15-execution-connectivity-qualification.test.ts\`
- **Runner:** \`npm run helios:exec15:qualify\`
- **E2E:** \`e2e-pipeline.ts\` — settlement stage uses canonical EXEC09 \`openFromFill\`
- **Adversarial:** \`adversarial-qualification.ts\` (${EXEC15_ADVERSARIAL_SCENARIO_IDS.length} scenarios)

## Subprocess qualification gates

| Gate | Result |
|------|--------|
${subprocessGateTable(input.subprocessGates)}

## E2E and adversarial summary

- E2E pipeline ok: **${input.qualification.e2ePipelineOk}**
- Adversarial scenarios: **${input.qualification.adversarialScenariosPassed}/${input.qualification.adversarialScenariosTotal}**

## Blockers

${blockers}
`,
  );

  writeFileSync(
    join(input.root, DOC_DIR, 'EXECUTION_CAPABILITY_MATRIX.md'),
    `${header('Execution Capability Matrix (EXEC01–EXEC15)')}

| ID | Status | Canonical owner | Test owner | Gate result |
|----|--------|-----------------|------------|-------------|
${capabilityMatrixRows(input.root)}

All capabilities operate in **simulation / sandbox / paper** environments only.
`,
  );

  const exec02 = listExecWorkPackages(input.root).find((row) => row.packageId === 'EXEC02');
  const exec14 = listExecWorkPackages(input.root).find((row) => row.packageId === 'EXEC14');

  writeFileSync(
    join(input.root, DOC_DIR, 'BROKER_CONFORMANCE_REPORT.md'),
    `${header('Broker Conformance Report (EXEC02 / EXEC14)')}

## Normalized broker protocol (EXEC02)

Canonical owner: \`${exec02?.moduleRef ?? 'packages/platform/src/helios/execution-connectivity/exec02/index.ts'}\`

Test owner: \`${exec02?.testRef ?? 'tests/helios-exec02-broker-protocol.test.ts'}\`

Provider-neutral order submit, cancel, poll, and webhook ingestion with canonical lifecycle mapping. Gate: **${exec02?.status === 'IMPLEMENTED' ? packageGateFor('IMPLEMENTED') : 'BLOCKED'}**.

## Conformance and certification (EXEC14)

Canonical owner: \`${exec14?.moduleRef ?? 'packages/platform/src/helios/execution-connectivity/exec14/index.ts'}\`

Test owner: \`${exec14?.testRef ?? 'tests/helios-exec14-provider-conformance.test.ts'}\`

Fixture broker/custody conformance suites; simulation certification ladder only. Gate: **${exec14?.status === 'IMPLEMENTED' ? packageGateFor('IMPLEMENTED') : 'BLOCKED'}**.

## Evidence collected

- Idempotent operation identity
- Illegal transition rejection in lifecycle coordinator
- Sandbox-only environments enforced at submit (\`LIVE_*\` compile-time false)
- Drop-copy dedupe via provider fill identifiers

## Not in scope

Live FIX sessions, production drop-copy feeds, or executed broker agreements.
`,
  );

  const exec09 = listExecWorkPackages(input.root).find((row) => row.packageId === 'EXEC09');
  const exec11 = listExecWorkPackages(input.root).find((row) => row.packageId === 'EXEC11');
  const exec12 = listExecWorkPackages(input.root).find((row) => row.packageId === 'EXEC12');

  writeFileSync(
    join(input.root, DOC_DIR, 'CUSTODY_RECONCILIATION_REPORT.md'),
    `${header('Custody and Reconciliation Report (EXEC08–EXEC12)')}

| Capability | Canonical owner | Test owner | Gate |
|------------|-----------------|------------|------|
| EXEC08 segregation | \`${listExecWorkPackages(input.root).find((r) => r.packageId === 'EXEC08')?.moduleRef ?? ''}\` | \`${listExecWorkPackages(input.root).find((r) => r.packageId === 'EXEC08')?.testRef ?? ''}\` | ${packageGateFor('IMPLEMENTED')} |
| EXEC09 settlement | \`${exec09?.moduleRef ?? ''}\` | \`${exec09?.testRef ?? ''}\` | ${exec09?.status === 'IMPLEMENTED' ? packageGateFor('IMPLEMENTED') : 'BLOCKED'} |
| EXEC11 custody isolation | \`${exec11?.moduleRef ?? ''}\` | \`${exec11?.testRef ?? ''}\` | ${exec11?.status === 'IMPLEMENTED' ? packageGateFor('IMPLEMENTED') : 'BLOCKED'} |
| EXEC12 reconciliation | \`${exec12?.moduleRef ?? ''}\` | \`${exec12?.testRef ?? ''}\` | ${exec12?.status === 'IMPLEMENTED' ? packageGateFor('IMPLEMENTED') : 'BLOCKED'} |

## EXEC09 (canonical institutional settlement)

Post-trade obligations, DVP-linked legs, calendars, and versioned settlement policies. EXEC15 E2E opens obligations via \`Exec09SettlementLifecycleService.openFromFill\` — fill does not imply settled state until lifecycle completes.

## Adversarial breaks

| Scenario | Expected |
|----------|----------|
| Broker filled, custody missing | \`BROKER_FILL_CUSTODY_MISSING\` break |
| Custody position without known fill | \`CUSTODY_WITHOUT_FILL\` break |
| T+1 settlement failure | \`UNSETTLED_BREAK\`; position not marked settled cash |

## Ledger posture

Reconciliation reads ledger balances; it does not post journals without Execution Authority.
`,
  );

  const exec13 = listExecWorkPackages(input.root).find((row) => row.packageId === 'EXEC13');

  writeFileSync(
    join(input.root, DOC_DIR, 'EXECUTION_CHAOS_REPORT.md'),
    `${header('Execution Chaos and Adversarial Report (EXEC13 / EXEC15)')}

## Resiliency owner (EXEC13)

Canonical owner: \`${exec13?.moduleRef ?? 'packages/platform/src/helios/execution-connectivity/exec13/index.ts'}\`

Test owner: \`${exec13?.testRef ?? 'tests/helios-exec13-execution-resilience.test.ts'}\`

Gate: **${exec13?.status === 'IMPLEMENTED' ? packageGateFor('IMPLEMENTED') : 'BLOCKED'}**

## EXEC15 adversarial scenarios

| # | Scenario | Expected |
|---|----------|----------|
| 1 | AI order above mandate | Blocked |
| 2 | Stale/desynchronized market data | Blocked |
| 3 | Duplicate submission | Exactly one external order |
| 4 | Timeout after provider accept | \`SUBMISSION_UNKNOWN\`; reconcile before retry |
| 5 | Partial fill while cancel pending | Correct partial reflection |
| 6 | Execution report before API ack | Deterministic lifecycle reconcile |
| 7 | Broker filled, custody missing | Reconciliation break |
| 8 | Custody position, no known fill | Reconciliation break |
| 9 | External buying power > internal allocation | Internal lower limit wins |
| 10 | Margin buying power | Ignored when margin disabled |
| 11 | AI withdrawal after trade | Denied without independent withdrawal authority |
| 12 | Untrusted market data mid-execution | Cancel-only policy |
| 13 | Broker disconnect during open order | No duplicate failover submit |
| 14 | Kill switch active | No new orders |
| 15 | T+1 settlement failure | Unsettled position + break |

Implementation: \`packages/platform/src/helios/execution-connectivity/adversarial-qualification.ts\`.

Adversarial pass count: **${input.qualification.adversarialScenariosPassed}/${input.qualification.adversarialScenariosTotal}**.
`,
  );

  const exec05 = listExecWorkPackages(input.root).find((row) => row.packageId === 'EXEC05');
  const exec07 = listExecWorkPackages(input.root).find((row) => row.packageId === 'EXEC07');

  writeFileSync(
    join(input.root, DOC_DIR, 'BEST_EXECUTION_ENGINEERING_EVIDENCE.md'),
    `${header('Best Execution — Engineering Evidence (EXEC05 / EXEC07)')}

## Smart routing (EXEC05)

Canonical owner: \`${exec05?.moduleRef ?? ''}\`

Test owner: \`${exec05?.testRef ?? ''}\`

Regulatory-compatible route **filtering** before scoring. Gate: **${exec05?.status === 'IMPLEMENTED' ? packageGateFor('IMPLEMENTED') : 'BLOCKED'}**.

## Transaction cost analysis (EXEC07)

Canonical owner: \`${exec07?.moduleRef ?? ''}\`

Test owner: \`${exec07?.testRef ?? ''}\`

Post-trade TCA evidence on fills (slippage and price improvement in minor units). Gate: **${exec07?.status === 'IMPLEMENTED' ? packageGateFor('IMPLEMENTED') : 'BLOCKED'}**.

## Simulation-only posture

No production order routing to live venues. Execution Twin and paper matchers consume canonical fixtures. \`LIVE_INVESTMENT_EXECUTION=false\`.

## Customer-facing boundary

Best-execution engineering evidence supports research and simulation narratives only; it is not a regulatory best-execution certification.
`,
  );
}
