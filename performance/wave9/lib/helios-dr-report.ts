import type { HeliosRestartRecoveryQualification } from '../../../packages/platform/src/helios/hardening/restart-recovery-qualification.ts';

export function renderHeliosDisasterRecoveryQualificationMarkdown(
  qualification: HeliosRestartRecoveryQualification,
  input: { readonly gitSha: string; readonly evaluatedAtUtc: string },
): string {
  const { report } = qualification;
  const stepRows = report.steps
    .map((row) => `| \`${row.stepId}\` | ${row.pass ? 'PASS' : 'FAIL'} | ${row.durationMs} | ${row.detail} |`)
    .join('\n');
  const failureRows = report.failureModes
    .map(
      (row) =>
        `| \`${row.modeId}\` | ${row.pass ? 'PASS' : 'FAIL'} | ${row.failClosed ? 'yes' : 'no'} | ${row.detail} |`,
    )
    .join('\n');
  const proofRows = report.postRestoreProofs
    .map((row) => `| \`${row.proofId}\` | ${row.pass ? 'PASS' : 'FAIL'} | ${row.detail} |`)
    .join('\n');

  return `# HELIOS disaster recovery qualification (HEALTH08)

**Program:** \`${report.program}\`  
**Marker:** \`${qualification.marker}\`  
**Qualified:** ${qualification.qualified ? 'yes' : 'no'}  
**Git SHA:** \`${input.gitSha}\`  
**Evaluated (UTC):** ${input.evaluatedAtUtc}

## Scope

Self-contained engineering qualification harness for restart, backup, and recovery.
Uses an ephemeral fixture tier by default; GitHub Actions and local runs may attach
the ephemeral PostgreSQL tier via \`npm run db:up\` and \`SUNREY_PERSISTENCE_TEST=1\`.

This document records **engineering** recovery point/time measurements only.
It is **not** a production RPO/RTO commitment.

## Engineering RPO / RTO

| Metric | Value | Tier |
| --- | ---: | --- |
| RPO | ${report.engineeringSlo.rpoMs} ms | ${report.engineeringSlo.tier} |
| RTO | ${report.engineeringSlo.rtoMs} ms | ${report.engineeringSlo.tier} |

${report.engineeringSlo.disclaimer}

## Harness steps

| Step | Result | Duration (ms) | Detail |
| --- | --- | ---: | --- |
${stepRows}

## Failure modes (fail closed)

| Mode | Result | Fail closed | Detail |
| --- | --- | --- | --- |
${failureRows}

## Post-restore proofs

| Proof | Result | Detail |
| --- | --- | --- |
${proofRows}

## PostgreSQL tier

| Attempted | Pass |
| --- | --- |
| ${report.postgresTierAttempted ? 'yes' : 'no'} | ${report.postgresTierPass ? 'yes' : 'no'} |

## Blockers

${
  qualification.blockers.length === 0
    ? '_None._'
    : qualification.blockers.map((line) => `- ${line}`).join('\n')
}

## Commands

\`\`\`bash
npm run helios:health08:dr:qualify
npm run qualify:wave9:dr -- --suite database-failure,backup-restore,full-stack-restart
\`\`\`
`;
}
