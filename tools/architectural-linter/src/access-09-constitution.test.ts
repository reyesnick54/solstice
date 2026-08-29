import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { parseCapabilityTable } from './engineering-closure-guards.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const ACCESS_FABRIC = 'packages/sunrey-exchange/src/access-fabric';

describe('ACCESS-09 exchange capacity access constitution', () => {
  it('extends the canonical Exchange without a competing owner', () => {
    const declarationPath = join(
      REPO_ROOT,
      'docs/architecture/chunks/access-09-exchange-capacity-markets.json',
    );
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'ACCESS-09');
    assert.ok(declaration.requires.includes('sunrey-exchange'));
    assert.ok(declaration.requires.includes('ledger'));
    assert.ok(declaration.requires.includes('custody'));
    assert.ok(declaration.requires.includes('sunrey-productive-capacity'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-exchange').status, 'IMPLEMENTED');
    assert.equal(
      evaluateCapability(manifest, 'sunrey-exchange-capacity-access').status,
      'IMPLEMENTED',
    );
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'ACCESS-09',
    );
    assert.ok(declared);
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    const capability = manifest.capabilities.find(
      (row) => row.id === 'sunrey-exchange-capacity-access',
    );
    assert.ok(capability);
    assert.equal(capability.owner, 'packages/sunrey-exchange');
    assert.equal(capability.protected, true);

    const table = parseCapabilityTable(
      readFileSync(join(REPO_ROOT, 'docs/architecture/chunk-dependencies.md'), 'utf8'),
    );
    assert.ok(table.includes('sunrey-exchange-capacity-access'));

    for (const forbidden of [
      'packages/access-core',
      'packages/capacity-exchange',
      'packages/capacity-market',
      'packages/dual-economy-clearing',
      'packages/clearing-house',
      'packages/entitlements',
      'packages/access-ledger',
      'packages/exchange-v2',
    ]) {
      assert.equal(existsSync(join(REPO_ROOT, forbidden)), false, forbidden);
    }

    assert.equal(existsSync(join(REPO_ROOT, ACCESS_FABRIC, 'clearing.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, ACCESS_FABRIC, 'index.ts')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'docs/architecture/exchange-capacity-access-fabric.md')),
      true,
    );
  });

  it('keeps fiat on the canonical Ledger and native assets on custody or chain rails', () => {
    const clearing = readFileSync(join(REPO_ROOT, ACCESS_FABRIC, 'clearing.ts'), 'utf8');
    assert.match(clearing, /rail\.ledger\.postJournal\(/);
    assert.match(clearing, /executionAuthority: authority/);
    assert.match(clearing, /DEMAND_DEPOSIT_TO_PENDING_SETTLEMENT/);
    assert.match(clearing, /rails\.custody/);
    assert.match(clearing, /rails\.native/);
    assert.equal(/\.mint\(|mintCoin\(|issueCoin\(|finalizeIssuance\(/.test(clearing), false);
    assert.equal(/AuthorityIssuer/.test(clearing), false);

    const taxonomy = readFileSync(join(REPO_ROOT, ACCESS_FABRIC, 'taxonomy.ts'), 'utf8');
    for (const invariant of [
      'productionActivated: false as const',
      'mintsSunReyCoin: false as const',
      'mintsMoonReyCoin: false as const',
      'fixedSunReyMoonReyRatio: false as const',
      'createsThirdCurrency: false as const',
      'entitlementIsTransferableMoney: false as const',
      'storesCompetingBalanceLedger: false as const',
    ]) {
      assert.ok(taxonomy.includes(invariant), invariant);
    }
  });

  it('registers the access-fabric clearing path as an authorized journal writer', () => {
    const linter = readFileSync(
      join(REPO_ROOT, 'tools/architectural-linter/src/linter.ts'),
      'utf8',
    );
    assert.match(linter, /access-fabric\\\/clearing\\\.ts/);
    assert.match(linter, /product\\\/settlement\\\.ts/);
  });
});
