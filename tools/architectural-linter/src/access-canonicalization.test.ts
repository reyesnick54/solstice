import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import manifest from '../../../docs/architecture/manifest.json' with { type: 'json' };
import {
  ACCESS_CONCEPT_OWNERSHIP,
  ACCESS_DUAL_TOKEN_BOUNDARY,
  ACCESS_FORBIDDEN_COMPETING_PACKAGES,
  ACCESS_HIN_BOUNDARY,
  ACCESS_POLICY_COMPLIANCE_BOUNDARY,
} from '../../../packages/access-economy/src/canonical-ownership.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

type ManifestCapability = {
  readonly id: string;
  readonly owner: string;
  readonly status: string;
};

type ManifestComponent = {
  readonly id: string;
  readonly canonicalOwner: string;
  readonly canonicalPath: string;
};

const capabilities = manifest.capabilities as readonly ManifestCapability[];
const components = manifest.components as readonly ManifestComponent[];
const forbiddenRoots = manifest.forbiddenWorkspaceRoots as readonly string[];

function walkTs(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkTs(full, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function packageSources(pkg: string): readonly string[] {
  return walkTs(join(REPO_ROOT, pkg, 'src')).filter(
    (file) => !file.endsWith('.test.ts') && !file.endsWith('demo.ts'),
  );
}

function assertNoBannedMutators(files: readonly string[], banned: readonly string[]): void {
  const directKernelCall = /(?<![A-Za-z])ComplianceKernel\s*\(/;
  for (const file of files) {
    if (file.includes('/regulatory-controls/')) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    for (const symbol of banned) {
      if (symbol === 'ComplianceKernel') {
        assert.equal(
          directKernelCall.test(source),
          false,
          `${file} must not invoke ComplianceKernel directly`,
        );
        continue;
      }
      assert.equal(
        source.includes(`${symbol}(`),
        false,
        `${file} must not call ${symbol}() directly`,
      );
    }
  }
}

describe('Access architecture canonicalization (Wave 2 Prompt 5)', () => {
  it('aligns manifest capabilities with canonical ownership map', () => {
    const domain = capabilities.find((row) => row.id === 'sunrey-access-economy-domain');
    assert.equal(domain?.owner, ACCESS_CONCEPT_OWNERSHIP.accessIntent.owner);
    assert.equal(domain?.status, 'IMPLEMENTED');

    const entitlement = components.find((row) => row.id === 'sunrey-access-entitlement-engine');
    assert.equal(entitlement?.canonicalOwner, ACCESS_CONCEPT_OWNERSHIP.eligibility.owner);

    const clearing = components.find((row) => row.id === 'sunrey-exchange-capacity-access');
    assert.equal(clearing?.canonicalOwner, 'packages/sunrey-exchange');
  });

  it('rejects forbidden competing package roots in workspace and manifest', () => {
    for (const pkg of ACCESS_FORBIDDEN_COMPETING_PACKAGES) {
      assert.equal(existsSync(join(REPO_ROOT, pkg)), false, pkg);
      assert.equal(forbiddenRoots.includes(pkg), true, `${pkg} must be forbidden in manifest`);
    }
  });

  it('keeps access-economy and access-fabric free of direct ledger/kernel mutation', () => {
    const banned = ['postJournal', 'openAccount', 'new AuthorityIssuer', 'ComplianceKernel'];
    assertNoBannedMutators(packageSources('packages/access-economy'), banned);
    assertNoBannedMutators(packageSources('packages/access-fabric'), banned);
    assertNoBannedMutators(packageSources('packages/sunrey-access'), banned);
    assertNoBannedMutators(packageSources('packages/sunrey-access-fabric'), banned);
  });

  it('routes consumer HTTP access through human-access-economy only', () => {
    const accessBff = readFileSync(
      join(REPO_ROOT, 'services/api/src/consumer/access.ts'),
      'utf8',
    );
    assert.match(accessBff, /packages\/human-access-economy/);
    assert.equal(
      accessBff.includes('packages/access-economy/src/service.ts'),
      false,
      'BFF must not bypass human-access-economy adapter',
    );
  });

  it('keeps exchange clearing as the authorized ledger writer for ACCESS-09 fiat legs', () => {
    const clearing = readFileSync(
      join(REPO_ROOT, 'packages/sunrey-exchange/src/access-fabric/clearing.ts'),
      'utf8',
    );
    assert.match(clearing, /Ledger\.postJournal/);
    assert.match(clearing, /ExecutionAuthority/);
    assert.equal(
      ACCESS_DUAL_TOKEN_BOUNDARY.exchangeClearingOwner,
      'packages/sunrey-exchange/src/access-fabric/clearing.ts',
    );
  });

  it('uses entitlement subledger under access-economy, not a forbidden access-ledger package', () => {
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/access-economy/src/funding-solvency/entitlement-ledger.ts')),
      true,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'packages/access-ledger')), false);
    assert.equal(ACCESS_CONCEPT_OWNERSHIP.ledgerEvent.owner, 'packages/access-economy');
  });

  it('preserves HIN boundary constants', () => {
    const contract = readFileSync(
      join(REPO_ROOT, 'packages/access-economy/src/hin-access/contract.ts'),
      'utf8',
    );
    assert.match(contract, /HIN_ACCESS_BRIDGE_BOUNDARY/);
    assert.equal(ACCESS_HIN_BOUNDARY.personalDataCrossesBoundary, false);
    assert.equal(ACCESS_HIN_BOUNDARY.onlySettledSunReyAffectsTwab, true);
  });

  it('preserves policy/compliance separation', () => {
    const policy = readFileSync(join(REPO_ROOT, 'packages/access-fabric/src/policy.ts'), 'utf8');
    assert.match(policy, /AccessPolicyPort/);
    assert.equal(policy.includes('ComplianceKernel'), false);
    assert.equal(ACCESS_POLICY_COMPLIANCE_BOUNDARY.accessMustNotOverrideKernelRefusal, true);
  });

  it('does not introduce circular imports between access-economy and access-fabric', () => {
    const economyFiles = packageSources('packages/access-economy');
    const fabricFiles = packageSources('packages/access-fabric');
    for (const file of economyFiles) {
      const source = readFileSync(file, 'utf8');
      assert.equal(
        /from ['"].*packages\/access-fabric/.test(source),
        false,
        `${file} must not import access-fabric (dependency inversion pending)`,
      );
    }
    for (const file of fabricFiles) {
      const source = readFileSync(file, 'utf8');
      assert.equal(
        /from ['"].*packages\/access-economy/.test(source),
        false,
        `${file} must not import access-economy (engine-local types until migration)`,
      );
    }
  });

  it('registers sibling access-fabric module alongside sunrey-access-fabric', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'packages/access-fabric')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-access-fabric')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/access-fabric-v2')), false);
  });
});
