import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  RULE_ECONOMIC_AUTHORITY_DAG,
  RULE_PACKAGE_DEEP_IMPORT,
  lintPackageBoundary,
  lintPackageBoundarySource,
  resolveImportSpec,
} from './package-boundary-guards.ts';

function scaffoldPackages(root: string): void {
  for (const pkg of ['alpha', 'beta', 'ledger']) {
    mkdirSync(join(root, 'packages', pkg, 'src'), { recursive: true });
    writeFileSync(
      join(root, 'packages', pkg, 'src', 'index.ts'),
      `export const ${pkg}Public = true;\n`,
    );
    writeFileSync(
      join(root, 'packages', pkg, 'src', 'internal.ts'),
      `export const ${pkg}Internal = true;\n`,
    );
  }
  mkdirSync(join(root, 'packages', 'economic-awareness-fabric', 'src'), { recursive: true });
  writeFileSync(
    join(root, 'packages', 'economic-awareness-fabric', 'src', 'index.ts'),
    'export const eaf = true;\n',
  );
  mkdirSync(join(root, 'packages', 'ledger', 'src'), { recursive: true });
  writeFileSync(join(root, 'packages', 'ledger', 'src', 'journal.ts'), 'export const journal = true;\n');
  mkdirSync(join(root, 'docs', 'architecture'), { recursive: true });
  writeFileSync(
    join(root, 'docs', 'architecture', 'package-boundary-baseline.json'),
    JSON.stringify({ version: 1, violations: [] }, null, 2),
  );
}

describe('package boundary guards', () => {
  it('A. catches package alias deep import', () => {
    const root = mkdtempSync(join(tmpdir(), 'pkg-boundary-a-'));
    scaffoldPackages(root);
    const file = join(root, 'packages/alpha/src/consumer.ts');
    writeFileSync(
      file,
      "import { betaInternal } from '@solstice/beta/src/internal.ts';\n",
    );
    const hits = lintPackageBoundarySource(root, file, read(file));
    rmSync(root, { recursive: true, force: true });
    assert.ok(hits.some((h) => h.rule === RULE_PACKAGE_DEEP_IMPORT));
  });

  it('B. catches one-level relative cross-package import', () => {
    const root = mkdtempSync(join(tmpdir(), 'pkg-boundary-b-'));
    scaffoldPackages(root);
    const file = join(root, 'packages/alpha/src/consumer.ts');
    writeFileSync(file, "import { betaInternal } from '../../beta/src/internal.ts';\n");
    const hits = lintPackageBoundarySource(root, file, read(file));
    rmSync(root, { recursive: true, force: true });
    assert.ok(hits.some((h) => h.rule === RULE_PACKAGE_DEEP_IMPORT));
  });

  it('C. catches multiple-level relative cross-package import', () => {
    const root = mkdtempSync(join(tmpdir(), 'pkg-boundary-c-'));
    scaffoldPackages(root);
    mkdirSync(join(root, 'packages/alpha/src/nested/deep'), { recursive: true });
    const file = join(root, 'packages/alpha/src/nested/deep/consumer.ts');
    writeFileSync(file, "import { betaInternal } from '../../../../beta/src/internal.ts';\n");
    const hits = lintPackageBoundarySource(root, file, read(file));
    rmSync(root, { recursive: true, force: true });
    assert.ok(hits.some((h) => h.rule === RULE_PACKAGE_DEEP_IMPORT));
  });

  it('D. catches TypeScript alias resolving into another package internals', () => {
    const root = mkdtempSync(join(tmpdir(), 'pkg-boundary-d-'));
    scaffoldPackages(root);
    const file = join(root, 'packages/alpha/src/consumer.ts');
    const spec = '@solstice/beta/src/internal.ts';
    const resolved = resolveImportSpec(file, spec, root);
    assert.ok(resolved?.endsWith('packages/beta/src/internal.ts'));
    writeFileSync(file, `import { betaInternal } from '${spec}';\n`);
    const hits = lintPackageBoundarySource(root, file, read(file));
    rmSync(root, { recursive: true, force: true });
    assert.ok(hits.some((h) => h.rule === RULE_PACKAGE_DEEP_IMPORT));
  });

  it('E. allows public package import', () => {
    const root = mkdtempSync(join(tmpdir(), 'pkg-boundary-e-'));
    scaffoldPackages(root);
    const file = join(root, 'packages/alpha/src/consumer.ts');
    writeFileSync(file, "import { betaPublic } from '@solstice/beta';\n");
    const hits = lintPackageBoundarySource(root, file, read(file));
    rmSync(root, { recursive: true, force: true });
    assert.equal(hits.length, 0);
  });

  it('F. allows legal same-package relative import', () => {
    const root = mkdtempSync(join(tmpdir(), 'pkg-boundary-f-'));
    scaffoldPackages(root);
    const file = join(root, 'packages/alpha/src/consumer.ts');
    writeFileSync(file, "import { alphaInternal } from './internal.ts';\n");
    const hits = lintPackageBoundarySource(root, file, read(file));
    rmSync(root, { recursive: true, force: true });
    assert.equal(hits.length, 0);
  });

  it('G. forbids EAF to issuance dependency', () => {
    const root = mkdtempSync(join(tmpdir(), 'pkg-boundary-g-'));
    scaffoldPackages(root);
    const file = join(root, 'packages/economic-awareness-fabric/src/bridge.ts');
    writeFileSync(file, "import { journal } from '../../ledger/src/journal.ts';\n");
    const hits = lintPackageBoundarySource(root, file, read(file));
    rmSync(root, { recursive: true, force: true });
    assert.ok(hits.some((h) => h.rule === RULE_ECONOMIC_AUTHORITY_DAG));
  });

  it('fails lintPackageBoundary when a new violation is introduced', () => {
    const root = mkdtempSync(join(tmpdir(), 'pkg-boundary-new-'));
    scaffoldPackages(root);
    writeFileSync(
      join(root, 'packages/alpha/src/new-violation.ts'),
      "import { betaInternal } from '@solstice/beta/src/internal.ts';\n",
    );
    const findings = lintPackageBoundary(root);
    rmSync(root, { recursive: true, force: true });
    assert.ok(findings.some((f) => f.rule === RULE_PACKAGE_DEEP_IMPORT));
  });
});

function read(path: string): string {
  return readFileSync(path, 'utf8');
}
