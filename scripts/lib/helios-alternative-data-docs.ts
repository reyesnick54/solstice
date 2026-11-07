import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { UtcInstant } from '../../packages/domain/src/time.ts';
import type { CanonicalAltQualificationRow } from '../../packages/platform/src/helios/alternative-data-intelligence/canonical-stack-qualification.ts';
import { CANONICAL_ALT_MODULES } from '../../packages/platform/src/helios/alternative-data-intelligence/canonical-alt-modules.ts';
import { AAF_CERTIFIED_ALT_FEATURE_IDS } from '../../packages/platform/src/helios/alternative-data-intelligence/taxonomy.ts';
import { ALT14_ADVERSARIAL_SCENARIO_IDS } from '../../packages/platform/src/helios/alternative-data-intelligence/taxonomy.ts';

export type AlternativeDataDocWriteInput = {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly stackMarker: string;
  readonly qualified: boolean;
  readonly canonicalRows: readonly CanonicalAltQualificationRow[];
  readonly adversarialScenariosPassed: number;
  readonly adversarialScenariosTotal: number;
};

const DOC_DIR = 'docs/helios/alternative-data';

export function writeAlternativeDataQualificationDocs(input: AlternativeDataDocWriteInput): void {
  const header = (title: string) =>
    `# ${title}\n\n**Git SHA:** \`${input.gitSha}\`  \n**Qualification timestamp (UTC):** \`${input.evaluatedAt}\`  \n**Stack marker:** \`${input.stackMarker}\`  \n**Qualified:** ${input.qualified ? 'yes' : 'no'}  \n**Posture:** \`LIVE_TRADING_ENABLED=false\`; \`production_authorized=false\`  \n`;

  const matrixRows = input.canonicalRows
    .map(
      (row) =>
        `| ${row.packageId} | ${CANONICAL_ALT_MODULES.find((m) => m.packageId === row.packageId)?.capability ?? ''} | \`${row.implementationOwner}\` | \`${row.marker}\` | ${row.qualified ? 'QUALIFIED' : 'BLOCKED'} |`,
    )
    .join('\n');

  writeFileSync(
    join(input.root, DOC_DIR, 'ALTERNATIVE_DATA_CAPABILITY_MATRIX.md'),
    `${header('Alternative Data Capability Matrix')}

| Package | Capability | Implementation owner | Qualification marker | Result |
|---------|------------|----------------------|----------------------|--------|
${matrixRows}

Raw provider records do **not** enter Strategy Genome; only AAF-certified feature ids are exposed.
`,
  );

  writeFileSync(
    join(input.root, DOC_DIR, 'HELIOS_ALTERNATIVE_DATA_FINAL_REPORT.md'),
    `${header('HELIOS Alternative Data Intelligence — Final Report (ALT15 requalification)')}

## Objective

Requalify ALT01–ALT14 against canonical modules on current \`main\`. ALT14 agentic mesh and platform synthesis produce **research evidence only**; no live provider access or execution authority.

## Canonical stack qualification

| Package | Marker | Result |
|---------|--------|--------|
${input.canonicalRows.map((row) => `| ${row.packageId} | \`${row.marker}\` | ${row.qualified ? 'QUALIFIED' : `BLOCKED (${row.blockers.join('; ')})`} |`).join('\n')}

## Gates

- Adversarial scenarios: ${input.adversarialScenariosPassed}/${input.adversarialScenariosTotal}
- Command: \`npm run helios:alt15:qualify\`
- Evidence JSON: \`performance/helios/results/helios-alt15/\`
`,
  );

  writeFileSync(
    join(input.root, DOC_DIR, 'ALTERNATIVE_DATA_SIGNAL_VALIDATION.md'),
    `${header('Alternative Data Signal Validation')}

## AAF-certified Strategy Genome features

${AAF_CERTIFIED_ALT_FEATURE_IDS.map((id) => `- \`${id}\``).join('\n')}

## Incremental information

Holdout incremental lift is required before \`AAFQualification=CERTIFIED\`. Features with excellent in-sample fit but no holdout information are rejected (\`holdout_incremental_reject\` scenario).

## Adversarial harness

${ALT14_ADVERSARIAL_SCENARIO_IDS.length} simulation scenarios in \`adversarial-qualification.ts\` guard entity mapping, deduplication, coverage bias, vintage preservation, cloud obscuration, night-lights calibration, AIS cargo unknown, contract ceiling vs obligation, patent-without-commercialization, weak supply-chain edges, modality dropout, multiple-testing correction, and entitlement revocation.
`,
  );

  writeFileSync(
    join(input.root, DOC_DIR, 'ALTERNATIVE_DATA_PROVIDER_RISK.md'),
    `${header('Alternative Data Provider Risk')}

## Posture

- Fixture and sandbox providers only; canonical ingest under \`packages/external-data\` and \`packages/provider-sdk\`.
- Licensing encoded per \`SourceContribution.licensed\`; unlicensed sources block AAF certification.
- Provider entitlement revocation blocks new feature generation (\`provider_entitlement_revoked\` scenario).
- Provider revision histories must not rewrite decision-time vintages.

## Canonical rights owner (ALT02)

\`packages/provider-sdk/src/alternative-data-rights\` and \`packages/external-data/src/alternative-data-rights\` — qualification marker \`${input.canonicalRows.find((r) => r.packageId === 'ALT02')?.marker ?? 'n/a'}\`.
`,
  );

  writeFileSync(
    join(input.root, DOC_DIR, 'ALTERNATIVE_DATA_ENTITY_MAPPING_AUDIT.md'),
    `${header('Alternative Data Entity Mapping Audit')}

## Canonical owner (ALT03)

\`packages/platform/src/helios/alternative-data/alt03-entity-asset-graph\` — qualification marker \`${input.canonicalRows.find((r) => r.packageId === 'ALT03')?.marker ?? 'n/a'}\`.

## Rules

1. Requested entity id must match resolved entity id with confidence ≥ 0.85 or features are blocked (\`wrong_company_mapping\` scenario).
2. Job posting fingerprints are deduplicated; duplicate density lowers quality scores.
3. Small-employer omission in online job feeds raises coverage warnings and corrections.
4. Entity resolution quality is surfaced on \`AlternativeDataResearchState.entityResolutionQuality\`.

## Evidence

Mapping audits are research artifacts sealed in \`evidenceRefs\`; they do not grant execution authority.
`,
  );
}
