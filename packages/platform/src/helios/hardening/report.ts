import type { EngineeringBaselineQualificationResult } from './qualification.ts';

function gateTable(result: EngineeringBaselineQualificationResult): string {
  return result.gates
    .map((row) => `| \`${row.gateId}\` | ${row.pass ? 'PASS' : 'FAIL'} | ${row.detail.replace(/\|/g, '\\|')} |`)
    .join('\n');
}

function scorecardTable(result: EngineeringBaselineQualificationResult): string {
  return result.scorecard
    .map(
      (row) =>
        `| ${row.dimension.replace(/_/g, ' ')} | ${row.status} | ${row.contributingGates.join(', ')} | ${row.detail.replace(/\|/g, '\\|')} |`,
    )
    .join('\n');
}

export function renderEngineeringBaselineMarkdown(
  result: EngineeringBaselineQualificationResult,
): string {
  const markerLine = result.qualified
    ? `\n> **Final marker:** \`${result.marker}\`\n`
    : `\n> **Final marker:** _not issued_ (\`${result.marker}\` — mandatory gates did not all pass)\n`;

  const blockers =
    result.blockers.length === 0
      ? '_None._'
      : result.blockers.map((line) => `- ${line}`).join('\n');

  return `# HELIOS Engineering Baseline V2 (HEALTH06)

**Program:** \`${result.program}\`  
**Schema:** \`${result.schema}\`  
**Evaluated (UTC):** ${result.evaluatedAt}  
**Git SHA:** \`${result.gitSha}\`  
**Live safety:** ${result.liveSafetyPass ? 'PASS' : 'FAIL'}
${markerLine}
## Objective

Establish a clean engineering baseline before the next major HELIOS intelligence wave. **No new product features** — qualification and evidence only.

## Verified posture

| Check | Expected |
| --- | --- |
| \`LIVE_TRADING_ENABLED\` | \`false\` |
| \`production_authorized\` (authority map) | \`false\` |

## Scorecard

| Dimension | Status | Gates | Detail |
| --- | --- | --- | --- |
${scorecardTable(result)}

## Mandatory gates

| Gate | Status | Detail |
| --- | --- | --- |
${gateTable(result)}

## Blockers

${blockers}

## Scope notes

- **HELIOS strict scoped typecheck** covers \`packages/platform/src/helios\`, Strategy Lab, Agentic Capital Mesh, venue conformance, HELIOS external-data ports, and \`tests/helios-*\` — independent of repository-wide TypeScript debt gated elsewhere in CI.
- **Extended assurance** (fuzz extended, formal extended, bench nightly, memory soak) must be executed locally or via their dedicated workflows; results are recorded here only when the HEALTH06 runner completes them successfully.
- Do **not** treat this document as live-pilot authorization or production activation.
`;
}
