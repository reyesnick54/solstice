import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { canonicalJson } from './hash.ts';
import type { EngineeringClosureBundle } from './types.ts';

export function formatEngineeringClosureReport(bundle: EngineeringClosureBundle): string {
  const { report } = bundle;
  return [
    'SunReyEngineeringClosureReport',
    `CORE_CODE_COMPLETE_CANDIDATE=${report.coreCodeCompleteCandidate}`,
    `PROTECTED_AUTHORITY_DUPLICATES=${report.duplicateProtectedAuthorities}`,
    `SUNREY_COIN_PATH_COMPLETE=${report.SunReyPathComplete}`,
    `MOONREY_COIN_PATH_COMPLETE=${report.MoonReyPathComplete}`,
    `DUAL_NATIVE_ASSETS=${bundle.dualEconomy.dualNativeAssets}`,
    `ETHEREUM_BASE_LAYER=${bundle.dualEconomy.ethereumBaseLayer}`,
    `PEVE_IS_HUMAN_WORTH=${bundle.dualEconomy.peveIsHumanWorth}`,
    `PEVE_IS_TOKEN_VALUATION=${bundle.dualEconomy.peveIsTokenValuation}`,
    `GPUV_EQUALS_MOONREY=${bundle.dualEconomy.gpuvEqualsMoonRey}`,
    `CHUNK_71_MONETARY_AUTHORITY=${bundle.dualEconomy.chunk71MonetaryAuthority}`,
    `ASSET_SUPPLYBOOK_CANONICAL=${bundle.dualEconomy.assetSupplyBookCanonical}`,
    `PRODUCTION_PARAMETERS_CONFIGURED=${report.productionParametersConfigured}`,
    `EXTERNAL_EVIDENCE_COMPLETE=${report.externalEvidenceComplete}`,
    `HUMAN_AUTHORIZATION_COMPLETE=${report.humanAuthorizationComplete}`,
    `LIVE_CONNECTIVITY_ENABLED=${report.liveConnectivityEnabled}`,
    `PRODUCTION_READY=${report.productionReady}`,
    `PRODUCTION_ACTIVE=${report.productionActive}`,
    `GENERAL_CORE_ARCHITECTURE_FEATURE_EXPANSION=${report.generalCoreArchitectureFeatureExpansion}`,
    `MOONREY_COIN_DECISION=${report.moonreyCoinDecision}`,
    `CLOSURE_HASH=${report.closureHash}`,
  ].join('\n');
}

export function architectureClosureDocument(bundle: EngineeringClosureBundle): string {
  const lines = [
    '# SunRey Engineering Closure',
    '',
    'This document is the final general core-architecture engineering closure report.',
    'It is an **engineering** label, not legal, licensed, audited, or production authorization.',
    '',
    '## Distinction',
    '',
    `- CORE_CODE_COMPLETE_CANDIDATE=${bundle.report.coreCodeCompleteCandidate}`,
    '- PRODUCTION_READY=false unless real external and human inputs are present',
    '- PRODUCTION_ACTIVE=false',
    '- LIVE_CONNECTIVITY_ENABLED=false',
    '',
    '## Freeze',
    '',
    'GENERAL CORE ARCHITECTURE FEATURE EXPANSION COMPLETE.',
    '',
    'Future work should normally fall into:',
    '',
    '- bug fix',
    '- security remediation',
    '- performance',
    '- provider-specific integration',
    '- external evidence ingestion',
    '- production parameter configuration',
    '- deployment/infrastructure',
    '- regulatory adaptation',
    '- user-facing product refinement',
    '',
    'rather than inventing another core authority.',
    '',
    '## MoonRey capability decision',
    '',
    'Classification **A**: `moonrey-coin` is an obsolete planned public-product placeholder.',
    'It is SUPERSEDED by `sunrey-native-assets` (protocol-native `MOONREY_COIN`) and',
    '`moonrey-issuance-engine`. Do not create `packages/moonrey-coin`.',
    '',
    '## Authority map',
    '',
    '| Authority | Owner | Path |',
    '| --- | --- | --- |',
    ...bundle.authority.map((row) => `| ${row.authority} | ${row.owner} | ${row.path} |`),
    '',
    '## Capability matrix',
    '',
    '| Group | Status | Owner |',
    '| --- | --- | --- |',
    ...bundle.matrix.map((row) => `| ${row.group} | ${row.status} | ${row.owner} |`),
    '',
    '## Legacy classifications',
    '',
    '| Id | Classification | Example |',
    '| --- | --- | --- |',
    ...bundle.legacy.map((row) => `| ${row.id} | ${row.classification} | ${row.example} |`),
    '',
    '## External blockers',
    '',
    ...bundle.externalInputs.map((row) => `- \`${row.id}\` — ${row.title} (present=${row.present}; domains=${row.activationDomains.join(', ')})`),
    '',
    '## Human decisions',
    '',
    ...bundle.humanDecisions.map((row) => `- \`${row.decisionId}\` — ${row.title} (unresolved=${row.unresolved}; aiMayDecide=${row.aiMayDecide})`),
    '',
    '## Closure hashes',
    '',
    `- sourceCommit: \`${bundle.report.sourceCommit}\``,
    `- architectureManifestHash: \`${bundle.report.architectureManifestHash}\``,
    `- launchCandidateFreezeHash: \`${bundle.report.launchCandidateFreezeHash}\``,
    `- closureHash: \`${bundle.report.closureHash}\``,
    '',
  ];
  return lines.join('\n');
}

export function writeEngineeringClosureDocuments(bundle: EngineeringClosureBundle, root = process.cwd()): void {
  writeFileSync(join(root, 'docs/architecture/SUNREY_ENGINEERING_CLOSURE.md'), architectureClosureDocument(bundle));
  writeFileSync(join(root, 'docs/architecture/sunrey-engineering-closure.json'), `${canonicalJson(bundle)}\n`);
}
