import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  lintArchitectureFreeze,
  lintArchitectureFreezeDocuments,
  lintCompetingArchitecturePaths,
  lintDeprecatedPackageDependencies,
  lintPrivilegedImportBoundaries,
} from './architecture-freeze-guards.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('architecture freeze guards', () => {
  it('accepts the repository freeze, authority map, and closed production gates', () => {
    const findings = lintArchitectureFreeze(REPO_ROOT);
    assert.deepEqual(findings, []);
  });

  it('rejects a missing required freeze heading', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-freeze-'));
    mkdirSync(join(dir, 'docs/productization'), { recursive: true });
    writeFileSync(join(dir, 'docs/productization/SUNREY_PRODUCTION_ARCHITECTURE_FREEZE.md'), '# incomplete\n');
    writeFileSync(join(dir, 'docs/productization/SUNREY_PRODUCTIZATION_ENGINEERING_RULES.md'), 'missing\n');
    writeFileSync(join(dir, 'docs/productization/sunrey-authority-map.json'), '{}\n');
    const findings = lintArchitectureFreezeDocuments(dir);
    rmSync(dir, { recursive: true, force: true });
    assert.ok(findings.some((row) => row.rule === 'architecture-freeze-incomplete'));
  });

  it('rejects a competing ledger package', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-ledger-v2-'));
    mkdirSync(join(dir, 'packages/ledger-v2'), { recursive: true });
    const findings = lintCompetingArchitecturePaths(dir);
    rmSync(dir, { recursive: true, force: true });
    const hit = findings.find((row) => row.file === 'packages/ledger-v2');
    assert.ok(hit);
    assert.equal(hit.rule, 'forbidden-competing-path');
  });

  it('rejects Agent import of Execution Authority issuance', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-agent-ea-'));
    mkdirSync(join(dir, 'packages/agent/src'), { recursive: true });
    writeFileSync(
      join(dir, 'packages/agent/src/evil.ts'),
      "import { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';\n",
    );
    const findings = lintPrivilegedImportBoundaries(dir);
    rmSync(dir, { recursive: true, force: true });
    const hit = findings.find((row) => row.rule === 'agent-privileged-import');
    assert.ok(hit);
  });

  it('rejects frontend import of Ledger internals', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-frontend-'));
    mkdirSync(join(dir, 'apps/web'), { recursive: true });
    writeFileSync(join(dir, 'apps/web/app.ts'), "import { Ledger } from '../../packages/ledger/src/journal.ts';\n");
    const findings = lintPrivilegedImportBoundaries(dir);
    rmSync(dir, { recursive: true, force: true });
    const hit = findings.find((row) => row.rule === 'frontend-privileged-import');
    assert.ok(hit);
  });

  it('rejects a provider-to-Ledger shortcut', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-provider-'));
    mkdirSync(join(dir, 'packages/payments/src/production-candidate'), { recursive: true });
    writeFileSync(
      join(dir, 'packages/payments/src/production-candidate/shortcut.ts'),
      'export function bad(ledger) {\n  return ledger.postJournal(request);\n}\n',
    );
    const findings = lintPrivilegedImportBoundaries(dir);
    rmSync(dir, { recursive: true, force: true });
    const hit = findings.find((row) => row.rule === 'provider-ledger-shortcut');
    assert.ok(hit);
  });

  it('rejects a deprecated package dependency', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-deprecated-dep-'));
    writeFileSync(join(dir, 'package.json'), '{\n  "dependencies": {\n    "@solstice/ledger-v2": "0.0.1"\n  }\n}\n');
    const findings = lintDeprecatedPackageDependencies(dir);
    rmSync(dir, { recursive: true, force: true });
    const hit = findings.find((row) => row.rule === 'deprecated-package-dependency');
    assert.ok(hit);
  });
});
