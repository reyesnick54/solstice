#!/usr/bin/env node
/**
 * Validate canonical build-status governance:
 * - single authoritative markdown path (no case-colliding duplicates)
 * - machine-readable metadata vocabulary and posture
 * - alignment with simulation-only flags in packages/config
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CANONICAL_MD = join(ROOT, 'docs/BUILD_STATUS.md');
const METADATA_JSON = join(ROOT, 'docs/build-status.json');
const FLAGS_TS = join(ROOT, 'packages/config/src/flags.ts');
const DOCS_DIR = join(ROOT, 'docs');

const FORBIDDEN_DOC_BASENAMES = new Set([
  'build-status.md',
  'BUILD-STATUS.md',
]);

const IMPLEMENTATION_VALUES = new Set([
  'NOT_IMPLEMENTED',
  'PARTIAL',
  'IMPLEMENTED',
  'SIMULATED',
  'CONFIGURED',
  'INTEGRATION_READY',
  'LIVE_REACHABLE',
  'LIVE_VALIDATED',
  'PRODUCTION_QUALIFIED',
  'BLOCKED',
  'EXTERNAL_DEPENDENCY',
  'REGULATORY_GATED',
]);

const TEST_VALUES = new Set(['PASSING', 'PARTIAL', 'ABSENT']);
const INTEGRATION_VALUES = new Set([
  'NOT_IMPLEMENTED',
  'SIMULATED',
  'CONFIGURED',
  'INTEGRATION_READY',
  'LIVE_REACHABLE',
  'LIVE_VALIDATED',
]);
const SECURITY_VALUES = new Set([
  'NOT_ASSESSED',
  'ENGINEERING_VERIFIED',
  'INDEPENDENT_AUDIT_PENDING',
  'PRODUCTION_QUALIFIED',
]);
const REGULATORY_VALUES = new Set([
  'NOT_APPLICABLE',
  'RESEARCH_REQUIRED',
  'REGULATORY_GATED',
  'EXTERNAL_DEPENDENCY',
  'CONFIRMED_BY_COUNSEL',
]);
const PRODUCTION_VALUES = new Set([
  'NOT_PRODUCTION_QUALIFIED',
  'ENGINEERING_QUALIFIED',
  'PRODUCTION_CANDIDATE',
  'PRODUCTION_ACTIVE',
]);

const errors = [];

function fail(message) {
  errors.push(message);
}

function assertFile(path, label) {
  if (!existsSync(path)) {
    fail(`missing ${label}: ${path}`);
    return false;
  }
  return true;
}

function listForbiddenCollisions() {
  if (!existsSync(DOCS_DIR)) return [];
  const hits = [];
  for (const entry of readdirSync(DOCS_DIR)) {
    if (FORBIDDEN_DOC_BASENAMES.has(entry)) {
      hits.push(join('docs', entry));
    }
  }
  return hits;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`invalid JSON at ${path}: ${error.message}`);
    return null;
  }
}

function validateVocabulary(name, values, allowed) {
  if (!Array.isArray(values)) {
    fail(`build-status.json vocabulary.${name} must be an array`);
    return;
  }
  for (const value of values) {
    if (!allowed.has(value)) {
      fail(`build-status.json vocabulary.${name} contains unknown value: ${value}`);
    }
  }
}

function validateSystems(systems) {
  if (!Array.isArray(systems) || systems.length === 0) {
    fail('build-status.json must contain a non-empty systems array');
    return;
  }
  const ids = new Set();
  for (const system of systems) {
    for (const field of ['id', 'name', 'implementation', 'tests', 'integration', 'security', 'regulatory', 'production']) {
      if (typeof system[field] !== 'string' || system[field].length === 0) {
        fail(`system ${system.id ?? '<unknown>'} missing string field ${field}`);
      }
    }
    if (ids.has(system.id)) {
      fail(`duplicate system id: ${system.id}`);
    }
    ids.add(system.id);
    if (!IMPLEMENTATION_VALUES.has(system.implementation)) {
      fail(`system ${system.id} invalid implementation: ${system.implementation}`);
    }
    if (!TEST_VALUES.has(system.tests)) {
      fail(`system ${system.id} invalid tests: ${system.tests}`);
    }
    if (!INTEGRATION_VALUES.has(system.integration)) {
      fail(`system ${system.id} invalid integration: ${system.integration}`);
    }
    if (!SECURITY_VALUES.has(system.security)) {
      fail(`system ${system.id} invalid security: ${system.security}`);
    }
    if (!REGULATORY_VALUES.has(system.regulatory)) {
      fail(`system ${system.id} invalid regulatory: ${system.regulatory}`);
    }
    if (!PRODUCTION_VALUES.has(system.production)) {
      fail(`system ${system.id} invalid production: ${system.production}`);
    }
    if (system.production === 'PRODUCTION_ACTIVE') {
      fail(`system ${system.id} must not claim PRODUCTION_ACTIVE in simulation tree`);
    }
    if (
      system.integration === 'LIVE_VALIDATED' ||
      system.implementation === 'LIVE_VALIDATED' ||
      system.implementation === 'PRODUCTION_QUALIFIED'
    ) {
      fail(`system ${system.id} must not claim live/production-qualified integration in simulation tree`);
    }
  }
}

function validatePosture(metadata, flagsSource) {
  const posture = metadata.repositoryPosture ?? {};
  if (posture.environment !== 'simulation') {
    fail('repositoryPosture.environment must be simulation');
  }
  if (posture.liveFlagsAllFalse !== true) {
    fail('repositoryPosture.liveFlagsAllFalse must be true');
  }
  if (posture.productionHsmKmsConfigured !== false) {
    fail('repositoryPosture.productionHsmKmsConfigured must be false');
  }
  if (posture.mainnetEnabled !== false) {
    fail('repositoryPosture.mainnetEnabled must be false');
  }
  if (posture.productionAuthorized !== false) {
    fail('repositoryPosture.productionAuthorized must be false');
  }
  if (!flagsSource.includes("export const ENVIRONMENT = 'simulation'")) {
    fail('packages/config/src/flags.ts must keep ENVIRONMENT=simulation');
  }
  if (!flagsSource.includes('PRODUCTION_HSM_KMS_CONFIGURED = false')) {
    fail('packages/config/src/flags.ts must keep PRODUCTION_HSM_KMS_CONFIGURED=false');
  }
}

function validateCanonicalDocument(metadata) {
  if (metadata.canonicalDocument !== 'docs/BUILD_STATUS.md') {
    fail('build-status.json canonicalDocument must be docs/BUILD_STATUS.md');
  }
  const md = readFileSync(CANONICAL_MD, 'utf8');
  if (!md.includes('single authoritative build-status document')) {
    fail('docs/BUILD_STATUS.md must declare itself as the single authoritative build-status document');
  }
  if (!md.includes('build-status.json')) {
    fail('docs/BUILD_STATUS.md must reference docs/build-status.json');
  }
}

function main() {
  const collisions = listForbiddenCollisions();
  if (collisions.length > 0) {
    fail(`forbidden case-colliding build-status paths remain: ${collisions.join(', ')}`);
  }

  if (!assertFile(CANONICAL_MD, 'canonical build status markdown')) {
    process.exit(1);
  }
  if (!assertFile(METADATA_JSON, 'build status metadata JSON')) {
    process.exit(1);
  }
  if (!assertFile(FLAGS_TS, 'simulation flags')) {
    process.exit(1);
  }

  const metadata = readJson(METADATA_JSON);
  if (!metadata) {
    process.exit(1);
  }

  if (metadata.schemaVersion !== 1) {
    fail('build-status.json schemaVersion must be 1');
  }

  validateVocabulary('implementation', metadata.vocabulary?.implementation, IMPLEMENTATION_VALUES);
  validateVocabulary('tests', metadata.vocabulary?.tests, TEST_VALUES);
  validateVocabulary('integration', metadata.vocabulary?.integration, INTEGRATION_VALUES);
  validateVocabulary('security', metadata.vocabulary?.security, SECURITY_VALUES);
  validateVocabulary('regulatory', metadata.vocabulary?.regulatory, REGULATORY_VALUES);
  validateVocabulary('production', metadata.vocabulary?.production, PRODUCTION_VALUES);
  validateSystems(metadata.systems);
  validatePosture(metadata, readFileSync(FLAGS_TS, 'utf8'));
  validateCanonicalDocument(metadata);

  if (errors.length > 0) {
    console.error('check-build-status: failed');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log('check-build-status: ok');
}

main();
