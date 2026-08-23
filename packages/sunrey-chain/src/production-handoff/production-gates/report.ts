import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { externalAssurancePackages, providerCertificationHandoffs } from './assurance.ts';
import { PRODUCTION_STAFFING_ROLES } from './catalog.ts';
import { prepareLaunchCeremonyChecklist } from './ceremony.ts';
import { countByCategory, currentRepositoryGateSnapshot } from './evaluate.ts';
import { canonicalJson } from './hash.ts';
import type { ProductionGateSnapshot } from './types.ts';

function linesFor(snapshot: ProductionGateSnapshot, prefix: string): string[] {
  return snapshot.inputs
    .filter((row) => row.gateId.startsWith(prefix))
    .map((row) => `- \`${row.gateId}\` — ${row.status} — ${row.description}`);
}

export function formatProductionGateReport(snapshot: ProductionGateSnapshot = currentRepositoryGateSnapshot()): string {
  const counts = countByCategory(snapshot);
  return [
    '# SunRey Production Gate Report',
    '',
    'Generated from the machine-readable External Input Registry.',
    'This report does not grant licenses, legal approvals, or activate production.',
    '',
    '## Distinction',
    '',
    `- BACKEND SOFTWARE READY=${snapshot.backendSoftwareReady}`,
    `- EXTERNAL GATES MISSING=${snapshot.externalGatesMissing}`,
    `- PRODUCTION ACTIVE=${snapshot.productionActive}`,
    `- PRODUCTION_READY=${snapshot.productionReady}`,
    `- LIVE_CONNECTIVITY_ENABLED=${snapshot.liveConnectivityEnabled}`,
    `- RELEASE_DECISION=${snapshot.releaseDecision}`,
    '',
    '## Evaluation',
    '',
    `- schema: \`${snapshot.registryId}\``,
    `- evaluatedAtUtc: \`${snapshot.evaluatedAtUtc}\``,
    `- failClosed: ${snapshot.failClosed}`,
    `- totalGates: ${snapshot.inputs.length}`,
    `- satisfiedInternalGates: ${snapshot.satisfiedInternalGateIds.length}`,
    `- missingExternalGates: ${snapshot.missingExternalGateIds.length}`,
    `- expiredGates: ${snapshot.expiredGateIds.length}`,
    `- unverifiedGates: ${snapshot.unverifiedGateIds.length}`,
    `- registryHash: \`${snapshot.registryHash}\``,
    `- decisionHash: \`${snapshot.decisionHash}\``,
    '',
    '## Category counts',
    '',
    ...Object.entries(counts).map(([category, count]) => `- ${category}: ${count}`),
    '',
    '## Currently satisfied internal gates',
    '',
    ...snapshot.satisfiedInternalGateIds.map((id) => `- \`${id}\``),
    '',
    '## Regulatory gates',
    '',
    ...linesFor(snapshot, 'reg.'),
    '',
    '## Provider gates',
    '',
    ...linesFor(snapshot, 'prv.'),
    '',
    '## Security gates',
    '',
    ...linesFor(snapshot, 'sec.'),
    '',
    '## AI gates',
    '',
    ...snapshot.inputs.filter((row) => row.gateId.startsWith('ai.')).map((row) => `- \`${row.gateId}\` — ${row.status} — ${row.description}`),
    '',
    '## Privacy / HIN gates',
    '',
    ...linesFor(snapshot, 'priv.'),
    '',
    '## Exchange / Mainnet gates',
    '',
    ...linesFor(snapshot, 'ex.'),
    ...linesFor(snapshot, 'chain.'),
    '',
    '## Staffing gates',
    '',
    ...linesFor(snapshot, 'ops.'),
    '',
    `Named people are not assigned. Required roles: ${PRODUCTION_STAFFING_ROLES.join(', ')}.`,
    '',
    '## Current release decision',
    '',
    `\`${snapshot.releaseDecision}\``,
    '',
    'Ordinary developers, AI, and the Agent cannot override missing required gates.',
    'Human governance may record an auditable exception only for explicitly eligible gates.',
    '',
    '## Production ceremony readiness',
    '',
    '- prepared: true',
    '- executed: false',
    '- Do not execute the ceremony from this report.',
    '',
  ].join('\n');
}

export function formatExternalAssuranceHandoff(): string {
  const packages = externalAssurancePackages();
  const providers = providerCertificationHandoffs();
  return [
    '# SunRey External Assurance Handoff',
    '',
    'Packages prepared for external reviewers. Prepared is not performed.',
    'Internal tests are not external audits.',
    '',
    ...packages.flatMap((row) => [
      `## ${row.audience} — ${row.title}`,
      '',
      row.notes,
      '',
      'Prepared paths:',
      ...row.preparedPaths.map((path) => `- \`${path}\``),
      '',
      'Still missing:',
      ...row.missingExternal.map((id) => `- \`${id}\``),
      '',
    ]),
    '## Provider certification handoff',
    '',
    '| Family | Tests | Credentials | Webhooks | Reconciliation | Certification | Limited-live path |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...providers.map(
      (row) =>
        `| ${row.family} | ${row.tests} | ${row.credentials} | ${row.webhooks} | ${row.reconciliation} | ${row.certification} | ${row.limitedLivePath} |`,
    ),
    '',
  ].join('\n');
}

export function formatLaunchCeremonyChecklistMarkdown(): string {
  const checklist = prepareLaunchCeremonyChecklist();
  return [
    '# SunRey Launch Ceremony Checklist',
    '',
    'Prepared. **Do not execute.**',
    '',
    `- prepared: ${checklist.prepared}`,
    `- executed: ${checklist.executed}`,
    `- productionActivated: ${checklist.productionActivated}`,
    `- releaseDecision: ${checklist.releaseDecision}`,
    '',
    '| Item | Status | Notes |',
    '| --- | --- | --- |',
    ...checklist.items.map((row) => `| ${row.label} | ${row.status} | ${row.notes} |`),
    '',
    'This checklist binds a future ceremony. Completing the list in software is not launch authorization.',
    '',
  ].join('\n');
}

export function serializeExternalInputRegistry(
  snapshot: ProductionGateSnapshot = currentRepositoryGateSnapshot(),
): Record<string, unknown> {
  return {
    schema: snapshot.registryId,
    schemaVersion: snapshot.schemaVersion,
    toolVersion: snapshot.toolVersion,
    evaluatedAtUtc: snapshot.evaluatedAtUtc,
    failClosed: snapshot.failClosed,
    productionActive: snapshot.productionActive,
    productionReady: snapshot.productionReady,
    liveConnectivityEnabled: snapshot.liveConnectivityEnabled,
    backendSoftwareReady: snapshot.backendSoftwareReady,
    externalGatesMissing: snapshot.externalGatesMissing,
    releaseDecision: snapshot.releaseDecision,
    registryHash: snapshot.registryHash,
    decisionHash: snapshot.decisionHash,
    totalGates: snapshot.inputs.length,
    satisfiedInternalGateIds: snapshot.satisfiedInternalGateIds,
    missingExternalGateIds: snapshot.missingExternalGateIds,
    inputs: snapshot.inputs.map((row) => ({
      gateId: row.gateId,
      category: row.category,
      description: row.description,
      requiredFor: row.requiredFor,
      jurisdiction: row.jurisdiction,
      status: row.status,
      evidenceReference: row.evidenceReference,
      ownerRole: row.ownerRole,
      expiration: row.expiration,
      lastValidated: row.lastValidated,
      notes: row.notes,
    })),
  };
}

export function writeProductionGateDocuments(
  root = process.cwd(),
  snapshot: ProductionGateSnapshot = currentRepositoryGateSnapshot(),
): void {
  writeFileSync(join(root, 'docs/productization/SUNREY_PRODUCTION_GATE_REPORT.md'), `${formatProductionGateReport(snapshot)}\n`);
  writeFileSync(join(root, 'docs/productization/SUNREY_EXTERNAL_ASSURANCE_HANDOFF.md'), `${formatExternalAssuranceHandoff()}\n`);
  writeFileSync(
    join(root, 'docs/productization/SUNREY_LAUNCH_CEREMONY_CHECKLIST.md'),
    `${formatLaunchCeremonyChecklistMarkdown()}\n`,
  );
  writeFileSync(
    join(root, 'docs/productization/sunrey-external-input-registry.json'),
    `${canonicalJson(serializeExternalInputRegistry(snapshot))}\n`,
  );
}
