import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const {
  checkJsonIntegrity,
  countPackageTestKeys,
  parseJsonStrict,
} = require('../scripts/check-json-integrity.mjs') as {
  checkJsonIntegrity: (root: string) => {
    findings: string[];
    packageJson?: { scripts?: { test?: string } };
    manifest?: {
      capabilities?: { id: string; owner?: string }[];
      components?: { id: string; canonicalOwner?: string }[];
    };
  };
  countPackageTestKeys: (text: string) => number;
  parseJsonStrict: (text: string, label: string) => unknown;
};
const { REQUIRED_TEST_FAMILIES, checkMergeIntegrity, detectConflictMarkers } = require('../scripts/check-merge-integrity.mjs') as {
  REQUIRED_TEST_FAMILIES: readonly { id: string; needle: string }[];
  checkMergeIntegrity: (root: string) => {
    findings: string[];
    report: {
      JSON_INTEGRITY: boolean;
      MERGE_MARKERS_PRESENT: boolean;
      PACKAGE_TEST_KEY_COUNT: number;
      ARCHITECTURE_CAPABILITY_IDS_UNIQUE: boolean;
      ARCHITECTURE_COMPONENT_IDS_UNIQUE: boolean;
      CHUNK_IDS_UNIQUE: boolean;
      CANONICAL_OWNER_COLLISIONS: number;
      LIVE_FLAGS_CHANGED: boolean;
      canonicalPackageCount: number;
      canonicalCapabilityCount: number;
      canonicalComponentCount: number;
      chunkDeclarationCount: number;
      architectureSchemaVersion: number | null;
    };
  };
  detectConflictMarkers: (text: string) => { line: number; text: string }[];
};

const ROOT = join(import.meta.dirname, '..');

function writeTree(root: string, files: Record<string, string>): void {
  for (const [rel, contents] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, contents);
  }
}

const COVERING_TEST =
  'node --test packages/security/src/regulated/**/*.test.ts packages/payments/src/**/*.test.ts packages/persistence/src/**/*.test.ts packages/sunrey-chain/src/release-candidate/economic/**/*.test.ts packages/sunrey-chain/src/native-assets/*.test.ts packages/sunrey-chain/src/production-ceremony/*.test.ts packages/sunrey-chain/src/release-candidate/mainnet/*.test.ts';

const MINIMAL_MANIFEST = `{
  "schemaVersion": 1,
  "name": "fixture",
  "purpose": "test",
  "codeownerDefault": "@reyesnick54",
  "packages": [],
  "components": [],
  "authorizedMutationPaths": [],
  "allowedCycles": [],
  "forbiddenWorkspaceRoots": [],
  "capabilities": [],
  "boundedContexts": [],
  "liveFlags": []
}
`;

const CLEAN_PACKAGE = `{
  "name": "fixture",
  "scripts": {
    "test": "${COVERING_TEST}"
  }
}
`;

describe('CHUNK-159 repository integrity', () => {
  it('package.json has exactly one test key', () => {
    const { findings, packageJson } = checkJsonIntegrity(ROOT);
    assert.deepEqual(findings, []);
    assert.equal(countPackageTestKeys(require('node:fs').readFileSync(join(ROOT, 'package.json'), 'utf8')), 1);
    assert.equal(typeof packageJson?.scripts?.test, 'string');
  });

  it('canonical test command includes regulated security tests', () => {
    const command = String(checkJsonIntegrity(ROOT).packageJson?.scripts?.test);
    assert.ok(command.includes('packages/security/src/regulated/'));
  });

  it('canonical test command includes nested payments tests', () => {
    const command = String(checkJsonIntegrity(ROOT).packageJson?.scripts?.test);
    assert.ok(command.includes('packages/payments/src/**/*.test.ts'));
  });

  it('canonical test command includes persistence tests', () => {
    const command = String(checkJsonIntegrity(ROOT).packageJson?.scripts?.test);
    assert.ok(command.includes('packages/persistence/src/**/*.test.ts'));
  });

  it('canonical test command includes economic RC tests', () => {
    const command = String(checkJsonIntegrity(ROOT).packageJson?.scripts?.test);
    assert.ok(command.includes('packages/sunrey-chain/src/release-candidate/economic/'));
    for (const family of REQUIRED_TEST_FAMILIES) {
      assert.ok(command.includes(family.needle), family.id);
    }
  });

  it('duplicate JSON key fixture fails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dup-json-key-'));
    writeTree(dir, {
      'package.json': `{
  "name": "fixture",
  "scripts": {
    "test": "echo first",
    "test": "echo second"
  }
}
`,
      'docs/architecture/manifest.json': MINIMAL_MANIFEST,
    });
    const { findings } = checkJsonIntegrity(dir);
    assert.ok(findings.some((item) => /duplicate key "test"/.test(item)));
  });

  it('duplicate capability ID fixture fails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dup-cap-'));
    writeTree(dir, {
      'package.json': CLEAN_PACKAGE,
      'docs/architecture/manifest.json': `{
  "schemaVersion": 1,
  "name": "fixture",
  "purpose": "test",
  "codeownerDefault": "@reyesnick54",
  "packages": [],
  "components": [],
  "authorizedMutationPaths": [],
  "allowedCycles": [],
  "forbiddenWorkspaceRoots": [],
  "capabilities": [
    { "id": "kernel", "status": "IMPLEMENTED", "owner": "packages/kernel", "protected": true },
    { "id": "kernel", "status": "IMPLEMENTED", "owner": "packages/kernel-v2", "protected": true }
  ],
  "boundedContexts": [],
  "liveFlags": []
}
`,
    });
    const { findings } = checkJsonIntegrity(dir);
    assert.ok(findings.some((item) => /duplicate capability id "kernel"/.test(item)));
  });

  it('duplicate component ID fixture fails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dup-comp-'));
    writeTree(dir, {
      'package.json': CLEAN_PACKAGE,
      'docs/architecture/manifest.json': `{
  "schemaVersion": 1,
  "name": "fixture",
  "purpose": "test",
  "codeownerDefault": "@reyesnick54",
  "packages": [],
  "components": [
    {
      "id": "ledger",
      "name": "Ledger",
      "canonicalOwner": "packages/ledger",
      "canonicalPath": "packages/ledger/src/journal.ts",
      "publicInterface": "packages/ledger/src/index.ts",
      "status": "IMPLEMENTED",
      "protected": true,
      "financialStateMutation": true,
      "executionAuthorityRequired": true,
      "kernelAuthorizationRequired": true,
      "protectedSymbols": [],
      "forbiddenAliases": [],
      "codeowners": []
    },
    {
      "id": "ledger",
      "name": "Ledger fork",
      "canonicalOwner": "packages/ledger-v2",
      "canonicalPath": "packages/ledger-v2/src/journal.ts",
      "publicInterface": "packages/ledger-v2/src/index.ts",
      "status": "IMPLEMENTED",
      "protected": true,
      "financialStateMutation": true,
      "executionAuthorityRequired": true,
      "kernelAuthorizationRequired": true,
      "protectedSymbols": [],
      "forbiddenAliases": [],
      "codeowners": []
    }
  ],
  "authorizedMutationPaths": [],
  "allowedCycles": [],
  "forbiddenWorkspaceRoots": [],
  "capabilities": [],
  "boundedContexts": [],
  "liveFlags": []
}
`,
    });
    const { findings } = checkJsonIntegrity(dir);
    assert.ok(findings.some((item) => /duplicate component id "ledger"/.test(item)));
  });

  it('merge conflict marker fixture fails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'conflict-'));
    const markerStart = `${'<'}${'<<<<<<'} HEAD`;
    const markerSep = `${'='}${'======'}`;
    const markerEnd = `${'>'}${'>>>>>>'} feature`;
    writeTree(dir, {
      'package.json': CLEAN_PACKAGE,
      'docs/architecture/manifest.json': MINIMAL_MANIFEST,
      'src/broken.ts': `${markerStart}\nconst a = 1;\n${markerSep}\nconst a = 2;\n${markerEnd}\n`,
    });
    assert.equal(detectConflictMarkers(`${markerStart}\n${markerSep}\n${markerEnd}\n`).length, 3);
    const { findings, report } = checkMergeIntegrity(dir);
    assert.equal(report.MERGE_MARKERS_PRESENT, true);
    assert.ok(findings.some((item) => /merge conflict marker/.test(item)));
  });

  it('clean fixture passes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'clean-integrity-'));
    writeTree(dir, {
      'package.json': CLEAN_PACKAGE,
      'docs/architecture/manifest.json': MINIMAL_MANIFEST,
      'docs/architecture/chunks/chunk-1.json': `{
  "chunk": "CHUNK-1",
  "title": "Example",
  "requires": ["architecture-linting"]
}
`,
      'AGENTS.md': `## Layout (this consolidated tree)\n\n- \`packages/money\` — bigint minor units\n\n## Commands\n`,
      '.github/workflows/ci.yml': `name: CI\non: [push]\njobs:\n  ci:\n    runs-on: ubuntu-latest\n  persistence:\n    runs-on: ubuntu-latest\n`,
    });
    const json = checkJsonIntegrity(dir);
    assert.deepEqual(json.findings, []);
    const merge = checkMergeIntegrity(dir);
    assert.deepEqual(merge.findings, []);
    assert.equal(merge.report.JSON_INTEGRITY, true);
    assert.equal(merge.report.MERGE_MARKERS_PRESENT, false);
    assert.equal(merge.report.PACKAGE_TEST_KEY_COUNT, 1);
    assert.equal(merge.report.CHUNK_IDS_UNIQUE, true);
  });

  it('production handoff owner remains canonical', () => {
    const { manifest } = checkJsonIntegrity(ROOT);
    const capability = manifest?.capabilities?.find((item) => item.id === 'sunrey-production-handoff');
    const component = manifest?.components?.find((item) => item.id === 'sunrey-production-handoff');
    assert.equal(capability?.owner, 'packages/sunrey-chain');
    assert.equal(component?.canonicalOwner, 'packages/sunrey-chain');
  });

  it('Chunk 158 capability remains present', () => {
    const { manifest } = checkJsonIntegrity(ROOT);
    assert.ok(manifest?.capabilities?.some((item) => item.id === 'sunrey-production-handoff'));
    const declaration = parseJsonStrict(
      require('node:fs').readFileSync(join(ROOT, 'docs/architecture/chunks/chunk-158.json'), 'utf8'),
      'chunk-158',
    ) as { chunk: string; requires: string[] };
    assert.equal(declaration.chunk, 'CHUNK-158');
    assert.ok(declaration.requires.includes('sunrey-production-handoff'));
  });

  it('no business authority changed', () => {
    const { manifest } = checkJsonIntegrity(ROOT);
    const owner = (id: string) => manifest?.capabilities?.find((item) => item.id === id)?.owner;
    assert.equal(owner('kernel'), 'packages/kernel');
    assert.equal(owner('ledger'), 'packages/ledger');
    assert.equal(owner('evidence'), 'packages/evidence');
    assert.equal(owner('permissions'), 'packages/permissions');
    assert.equal(owner('money'), 'packages/money');
    assert.equal(owner('sunrey-repository-integrity'), 'tools/architectural-linter');
  });

  it('no LIVE flag changed', () => {
    const { report } = checkMergeIntegrity(ROOT);
    assert.equal(report.LIVE_FLAGS_CHANGED, false);
    const flags = require('node:fs').readFileSync(join(ROOT, 'packages/config/src/flags.ts'), 'utf8');
    assert.match(flags, /export const ENVIRONMENT = 'simulation' as const;/);
    assert.match(flags, /export const LIVE_MONEY_ENABLED = false as const;/);
  });

  it('integrity report prints the structural counts', () => {
    const { report } = checkMergeIntegrity(ROOT);
    const text = [
      `JSON_INTEGRITY=${report.JSON_INTEGRITY}`,
      `MERGE_MARKERS_PRESENT=${report.MERGE_MARKERS_PRESENT}`,
      `PACKAGE_TEST_KEY_COUNT=${report.PACKAGE_TEST_KEY_COUNT}`,
      `ARCHITECTURE_CAPABILITY_IDS_UNIQUE=${report.ARCHITECTURE_CAPABILITY_IDS_UNIQUE}`,
      `ARCHITECTURE_COMPONENT_IDS_UNIQUE=${report.ARCHITECTURE_COMPONENT_IDS_UNIQUE}`,
      `CHUNK_IDS_UNIQUE=${report.CHUNK_IDS_UNIQUE}`,
      `CANONICAL_OWNER_COLLISIONS=${report.CANONICAL_OWNER_COLLISIONS}`,
      `LIVE_FLAGS_CHANGED=${report.LIVE_FLAGS_CHANGED}`,
    ].join('\n');
    assert.match(text, /JSON_INTEGRITY=true/);
    assert.match(text, /MERGE_MARKERS_PRESENT=false/);
    assert.match(text, /PACKAGE_TEST_KEY_COUNT=1/);
    assert.match(text, /ARCHITECTURE_CAPABILITY_IDS_UNIQUE=true/);
    assert.match(text, /ARCHITECTURE_COMPONENT_IDS_UNIQUE=true/);
    assert.match(text, /CHUNK_IDS_UNIQUE=true/);
    assert.match(text, /CANONICAL_OWNER_COLLISIONS=0/);
    assert.match(text, /LIVE_FLAGS_CHANGED=false/);
  });

  it('committed integrity baseline matches live structural counts', () => {
    const baseline = parseJsonStrict(
      require('node:fs').readFileSync(join(ROOT, 'docs/architecture/integrity-baseline.json'), 'utf8'),
      'integrity-baseline',
    ) as {
      purpose: string;
      architectureSchemaVersion: number;
      canonicalPackageCount: number;
      canonicalCapabilityCount: number;
      canonicalComponentCount: number;
      chunkDeclarationCount: number;
      singleTestScriptInvariant: boolean;
    };
    const { report } = checkMergeIntegrity(ROOT);
    assert.ok(baseline.purpose.includes('manifest.json remains architecture authority'));
    assert.equal(baseline.architectureSchemaVersion, report.architectureSchemaVersion);
    assert.equal(baseline.canonicalPackageCount, report.canonicalPackageCount);
    assert.equal(baseline.canonicalCapabilityCount, report.canonicalCapabilityCount);
    assert.equal(baseline.canonicalComponentCount, report.canonicalComponentCount);
    assert.equal(baseline.chunkDeclarationCount, report.chunkDeclarationCount);
    assert.equal(baseline.singleTestScriptInvariant, true);
  });
});
