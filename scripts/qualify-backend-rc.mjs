#!/usr/bin/env node
/**
 * Phase I Prompt 6 backend release-candidate evaluator.
 * Reuses existing authority, freeze, production-safety, and gate files.
 * Does not create a second architecture owner or flip production flags.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { parseJsonStrict } from './check-json-integrity.mjs';
import { checkAuthorityMap } from './check-authority-map.mjs';
import { checkArchitectureFreeze } from './check-architecture-freeze.mjs';
import { checkProductionSafety } from './check-production-safety.mjs';
import { checkApiSpecs } from './check-api-specs.mjs';
import { checkJsonIntegrity } from './check-json-integrity.mjs';
import { checkMergeIntegrity } from './check-merge-integrity.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RC_MANIFEST_REL = 'docs/productization/sunrey-backend-release-candidate.json';
export const RC_CONFIG_REL = 'docs/productization/sunrey-backend-rc-configuration.json';
export const RC_ARTIFACTS_REL = 'docs/productization/sunrey-backend-rc-artifacts.json';
export const RC_VERSION = 'sunrey-backend-v1.0.0-rc.2';
export const REHEARSAL_PLACEHOLDER_DIGEST =
  'sha256:6f1c2e8a9b0d4c7e5a3f1b8d2c0e4a6b8d1f3c5e7a9b0c2d4e6f8a0b1c3d5e7f';

const REQUIRED_SCREEN_IDS = [
  'ONBOARDING',
  'LOGIN',
  'HOME',
  'MONEY',
  'ACCOUNTS',
  'ACTIVITY',
  'SEND',
  'RECIPIENTS',
  'FX',
  'CARDS',
  'GROW',
  'GOALS',
  'PORTFOLIO',
  'AGENT',
  'ACTION_CENTER',
  'EXCHANGE',
  'SUNREY_COIN',
  'MOONREY_COIN',
  'WALLETS',
  'VAULT',
  'HIN',
  'PROFILE',
  'SECURITY',
  'NOTIFICATIONS',
  'SUPPORT',
];

const REQUIRED_HANDOFF_DOCS = [
  'docs/productization/SUNREY_LOVABLE_INTEGRATION_GUIDE.md',
  'docs/productization/SUNREY_LOVABLE_BFF_MAPPING.md',
  'docs/productization/SUNREY_LOVABLE_SCREEN_READINESS.md',
  'docs/productization/SUNREY_FRONTEND_AUTH_GUIDE.md',
  'docs/productization/SUNREY_API_ERROR_CATALOG.md',
  'docs/productization/SUNREY_PROVIDER_INTEGRATION_HANDOFF.md',
  'docs/productization/SUNREY_REGULATORY_LEGAL_HANDOFF.md',
  'docs/productization/SUNREY_SECURITY_AUDITOR_HANDOFF.md',
  'docs/productization/SUNREY_OPERATIONS_HANDOFF.md',
  'docs/productization/SUNREY_BACKEND_PRODUCTIZATION_FINAL_REPORT.md',
  'docs/productization/SUNREY_FINAL_PRODUCTIZATION_MATRIX.md',
  RC_MANIFEST_REL,
  RC_CONFIG_REL,
];

const UNIQUE_AUTHORITIES = [
  { id: 'ledger', owner: 'packages/ledger' },
  { id: 'kernel', owner: 'packages/kernel' },
  { id: 'execution-authority', owner: 'packages/permissions' },
  { id: 'identity', owner: 'packages/identity' },
  { id: 'compliance', owner: 'packages/kernel' },
  { id: 'sunrey-agent', owner: 'packages/sunrey-agent' },
  { id: 'exchange', owner: 'packages/sunrey-exchange' },
  { id: 'sunrey-chain-consensus', owner: 'packages/sunrey-chain' },
  { id: 'native-asset-supply', owner: 'packages/sunrey-chain' },
  { id: 'hin-rights', owner: 'packages/information-market' },
  { id: 'custody', owner: 'packages/custody' },
];

function loadJson(rel) {
  return parseJsonStrict(readFileSync(join(ROOT, rel), 'utf8'), rel);
}

function commandAvailable(name) {
  const result = spawnSync(name, ['--version'], { encoding: 'utf8' });
  return result.status === 0;
}

function gitRev() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

function gitObjectExists(sha) {
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    return false;
  }
  const result = spawnSync('git', ['cat-file', '-e', sha], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0;
}

export function evaluateBackendReleaseCandidate(root = ROOT) {
  const findings = [];
  const environment = {
    node: process.version,
    docker: commandAvailable('docker'),
    postgresClient: commandAvailable('psql') || commandAvailable('pg_isready'),
    rustc: commandAvailable('rustc'),
    cargo: commandAvailable('cargo'),
  };

  const json = checkJsonIntegrity(root);
  findings.push(...json.findings);
  const merge = checkMergeIntegrity(root);
  findings.push(...merge.findings.filter((row) => !json.findings.includes(row)));
  const authority = checkAuthorityMap(root);
  findings.push(...authority.findings);
  const freeze = checkArchitectureFreeze(root);
  findings.push(...freeze.findings.filter((row) => !authority.findings.includes(row)));
  const safety = checkProductionSafety(root);
  findings.push(...safety.findings);
  const api = checkApiSpecs(root);
  findings.push(...api.findings);

  const map = authority.map;
  const authorities = Array.isArray(map?.authorities) ? map.authorities : [];
  for (const expected of UNIQUE_AUTHORITIES) {
    const matches = authorities.filter((row) => row.id === expected.id);
    if (matches.length !== 1) {
      findings.push(`unique authority ${expected.id} count=${matches.length}`);
      continue;
    }
    if (matches[0].owner !== expected.owner) {
      findings.push(`authority ${expected.id} owner drifted to ${matches[0].owner}`);
    }
    if (matches[0].unique !== true) {
      findings.push(`authority ${expected.id} unique flag lost`);
    }
  }

  for (const rel of REQUIRED_HANDOFF_DOCS) {
    if (!existsSync(join(root, rel))) {
      findings.push(`missing handoff document ${rel}`);
    }
  }

  let manifest = null;
  if (existsSync(join(root, RC_MANIFEST_REL))) {
    try {
      manifest = loadJson(RC_MANIFEST_REL);
    } catch (error) {
      findings.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (manifest) {
    if (manifest.version !== RC_VERSION) {
      findings.push(`${RC_MANIFEST_REL}: version must be ${RC_VERSION}`);
    }
    const flags = manifest.productionFlags ?? {};
    for (const [name, expected] of [
      ['PRODUCTION_READY', false],
      ['PRODUCTION_ACTIVE', false],
      ['LIVE_CONNECTIVITY_ENABLED', false],
      ['MAINNET_ACTIVE', false],
      ['LIVE_EXCHANGE_ENABLED', false],
      ['LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED', false],
      ['LIVE_DATA_MARKETPLACE_ENABLED', false],
    ]) {
      if (flags[name] !== expected) {
        findings.push(`${RC_MANIFEST_REL}: productionFlags.${name} must be ${expected}`);
      }
    }
    if (manifest.recommendation !== 'BACKEND_RC_READY_PENDING_EXTERNAL_GATES') {
      findings.push(`${RC_MANIFEST_REL}: recommendation must remain BACKEND_RC_READY_PENDING_EXTERNAL_GATES while external gates are missing`);
    }
    const screens = manifest.lovable?.screens ?? [];
    for (const id of REQUIRED_SCREEN_IDS) {
      if (!screens.some((row) => row.id === id)) {
        findings.push(`${RC_MANIFEST_REL}: missing Lovable screen ${id}`);
      }
    }
    const missingExternal = manifest.externalGates?.missing ?? [];
    if (!Array.isArray(missingExternal) || missingExternal.length === 0) {
      findings.push(`${RC_MANIFEST_REL}: externalGates.missing must list remaining blockers`);
    }
    if (!gitObjectExists(String(manifest.commit ?? ''))) {
      findings.push(`${RC_MANIFEST_REL}: commit must be a real git object SHA, not a placeholder`);
    }
    if (manifest.buildArtifacts?.containerDigests === REHEARSAL_PLACEHOLDER_DIGEST) {
      findings.push(`${RC_MANIFEST_REL}: rehearsal placeholder must not be recorded as a completed container digest`);
    }
  }

  if (!existsSync(join(root, RC_ARTIFACTS_REL))) {
    findings.push(`missing ${RC_ARTIFACTS_REL}`);
  } else {
    try {
      const artifacts = loadJson(RC_ARTIFACTS_REL);
      if (artifacts.rcVersion !== RC_VERSION) {
        findings.push(`${RC_ARTIFACTS_REL}: rcVersion must be ${RC_VERSION}`);
      }
      if (artifacts.publishedToRegistry !== false) {
        findings.push(`${RC_ARTIFACTS_REL}: publishedToRegistry must remain false`);
      }
      const hashes = artifacts.sourceHashes ?? {};
      if (Object.keys(hashes).length === 0) {
        findings.push(`${RC_ARTIFACTS_REL}: sourceHashes must contain real file digests`);
      }
      for (const [rel, digest] of Object.entries(hashes)) {
        if (!/^sha256:[0-9a-f]{64}$/.test(String(digest))) {
          findings.push(`${RC_ARTIFACTS_REL}: ${rel} is not a sha256 digest`);
        }
        if (digest === REHEARSAL_PLACEHOLDER_DIGEST) {
          findings.push(`${RC_ARTIFACTS_REL}: ${rel} uses the rehearsal placeholder`);
        }
      }
      if (!artifacts.sbom?.generated || !Array.isArray(artifacts.sbom?.digests) || artifacts.sbom.digests.length === 0) {
        findings.push(`${RC_ARTIFACTS_REL}: SBOM evidence is missing`);
      }
      if (!artifacts.provenance?.generated || !artifacts.provenance?.digest) {
        findings.push(`${RC_ARTIFACTS_REL}: provenance evidence is missing`);
      }
      const container = artifacts.container ?? {};
      if (container.built === true) {
        if (container.imageId === REHEARSAL_PLACEHOLDER_DIGEST) {
          findings.push(`${RC_ARTIFACTS_REL}: container.imageId must not be the rehearsal placeholder`);
        }
        if (!/^sha256:[0-9a-f]{64}$/.test(String(container.imageId ?? ''))) {
          findings.push(`${RC_ARTIFACTS_REL}: container.imageId must be a real sha256 digest`);
        }
        if (container.publishedToRegistry !== false) {
          findings.push(`${RC_ARTIFACTS_REL}: container must not claim a registry publish`);
        }
      } else if (environment.docker) {
        findings.push(`${RC_ARTIFACTS_REL}: docker is available so a real local OCI image must be built`);
      }
    } catch (error) {
      findings.push(error instanceof Error ? error.message : String(error));
    }
  }

  const releaseRel = 'infra/sunrey-production/releases/preproduction-release.json';
  if (existsSync(join(root, releaseRel))) {
    try {
      const release = loadJson(releaseRel);
      if (release.containerDigest === REHEARSAL_PLACEHOLDER_DIGEST) {
        if (release.containerDigestKind !== 'SIMULATION_REHEARSAL_PLACEHOLDER') {
          findings.push(`${releaseRel}: rehearsal digest must be labeled SIMULATION_REHEARSAL_PLACEHOLDER`);
        }
      }
      if (release.productionAuthorized !== false || release.mainnetEnabled !== false) {
        findings.push(`${releaseRel}: productionAuthorized and mainnetEnabled must remain false`);
      }
      if (release.databaseMigrationVersion !== 'V040') {
        findings.push(`${releaseRel}: databaseMigrationVersion must be the latest customer version V040`);
      }
    } catch (error) {
      findings.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (existsSync(join(root, RC_CONFIG_REL))) {
    try {
      const config = loadJson(RC_CONFIG_REL);
      if (config.rcVersion !== RC_VERSION) {
        findings.push(`${RC_CONFIG_REL}: rcVersion must be ${RC_VERSION}`);
      }
      if (config.buildArtifacts?.containerDigests?.status === 'COMPLETED' && !config.buildArtifacts.containerDigests.digest) {
        findings.push(`${RC_CONFIG_REL}: completed container digest is missing`);
      }
      const flags = config.featureFlags ?? {};
      for (const name of [
        'PRODUCTION_READY',
        'PRODUCTION_ACTIVE',
        'LIVE_CONNECTIVITY_ENABLED',
        'MAINNET_ACTIVE',
        'LIVE_EXCHANGE_ENABLED',
        'LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED',
        'LIVE_DATA_MARKETPLACE_ENABLED',
      ]) {
        if (flags[name] !== false) {
          findings.push(`${RC_CONFIG_REL}: featureFlags.${name} must be false`);
        }
      }
    } catch (error) {
      findings.push(error instanceof Error ? error.message : String(error));
    }
  }

  const posture = map?.productionPosture ?? {};
  const status = {
    CORE_CODE_COMPLETE_CANDIDATE: posture.CORE_CODE_COMPLETE_CANDIDATE === true,
    BACKEND_PRODUCTION_RELEASE_CANDIDATE: findings.length === 0,
    LOVABLE_BACKEND_READY: findings.length === 0,
    PROVIDER_INTEGRATION_READY: findings.length === 0,
    PREPRODUCTION_DEPLOYABLE: findings.length === 0,
    TESTNET_DEPLOYABLE: findings.length === 0,
    EXTERNAL_SECURITY_REVIEW_READY: findings.length === 0,
    REGULATORY_REVIEW_READY: findings.length === 0,
    PRODUCTION_READY: false,
    PRODUCTION_ACTIVE: false,
    LIVE_CONNECTIVITY_ENABLED: false,
    MAINNET_ACTIVE: false,
    LIVE_EXCHANGE_ENABLED: false,
    LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED: false,
    LIVE_DATA_MARKETPLACE_ENABLED: false,
  };

  return {
    findings,
    environment,
    commit: gitRev(),
    version: RC_VERSION,
    status,
    screens: REQUIRED_SCREEN_IDS,
  };
}

function main() {
  const report = evaluateBackendReleaseCandidate(ROOT);
  const write = process.argv.includes('--write-evidence');
  if (write) {
    const out = join(ROOT, 'docs/productization/sunrey-backend-rc-evaluation.json');
    writeFileSync(
      out,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          id: 'sunrey.backend.rc.evaluation.v1',
          evaluatedAtUtc: new Date().toISOString(),
          version: report.version,
          commit: report.commit,
          findings: report.findings,
          environment: report.environment,
          status: report.status,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`wrote ${out}`);
  }
  if (report.findings.length > 0) {
    console.error('[RC] backend release-candidate evaluation failed:');
    for (const finding of report.findings) {
      console.error(`  ${finding}`);
    }
    process.exit(1);
  }
  console.log(`[RC] ${RC_VERSION} evaluation: ok`);
  console.log(`[RC] commit ${report.commit}`);
  console.log(`[RC] BACKEND_PRODUCTION_RELEASE_CANDIDATE=${report.status.BACKEND_PRODUCTION_RELEASE_CANDIDATE}`);
  console.log('[RC] PRODUCTION_READY=false PRODUCTION_ACTIVE=false');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
