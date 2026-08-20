import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CANONICAL_ENV_PREFIX,
  CANONICAL_PRODUCT_IDENTITY,
  CURRENT_MASTER_BRAND,
  GITHUB_REPOSITORY_PATH,
  GITHUB_REPOSITORY_RENAMED,
  HISTORICAL_HASH_DOMAINS_CHANGED,
  LEGACY_ENV_CONFLICT,
  LEGACY_ENV_COMPATIBILITY,
  LEGACY_MASTER_BRAND_ACTIVE,
  LegacyEnvConflictError,
  PROTOCOL_IDS_CHANGED,
  SUNREY_CHAIN_DISPLAY_NAME,
  SUNREY_EXCHANGE_DISPLAY_NAME,
  SUNREY_SDK_DISPLAY_NAME,
  buildSunReyLegacyCompatibilityReport,
  formatEnvResolutionDiagnostic,
  isSecretEnvName,
  resolveCanonicalEnv,
} from '../packages/config/src/index.ts';
import { ENVIRONMENT, LIVE_MONEY_ENABLED } from '../packages/config/src/flags.ts';
import { EVENT_SCHEMA_REFS, projectEventSchemaRef, schemaRefFor } from '../packages/events/src/taxonomy.ts';
import { asSolsticeIdentityId, asSunReyIdentityId } from '../packages/identity/src/ids.ts';
import { isPersistenceTestEnabled, persistenceEnvFromProcess } from '../packages/persistence/src/env.ts';
import { formatPersistenceDiagnostic } from '../packages/persistence/src/logging.ts';
import { HASH_DOMAINS } from '../packages/sunrey-chain/src/protocol/constants.ts';
import { explorerUsage } from '../packages/sunrey-explorer/src/cli.ts';
import { CHAIN_ID, EXPLORER_PRODUCT_BRAND, EXPLORER_PRODUCT_NAME, NETWORK_ID } from '../packages/sunrey-explorer/src/taxonomy.ts';
import { runSunReyDev } from '../packages/sunrey-sdk/src/developer-platform/cli.ts';
import {
  PUBLIC_ASSET_IDS,
  PUBLIC_CHAIN_ID,
  PUBLIC_NETWORK_ID,
  SUNREY_PUBLIC_PRODUCT_METADATA,
} from '../packages/sunrey-sdk/src/ids.ts';
import { evaluateChunkRequirements, loadManifest } from '../tools/architectural-linter/src/manifest.ts';
import { lintConstitution } from '../tools/architectural-linter/src/constitution.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('CHUNK-142 SunRey runtime naming migration', () => {
  it('root metadata says SunRey and uses canonical product identity', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      name: string;
      description: string;
    };
    assert.equal(pkg.name, 'sunrey');
    assert.match(pkg.description, /SunRey/);
    assert.equal(pkg.description.includes('Solstice'), false);
    assert.equal(CURRENT_MASTER_BRAND, 'SunRey');
    assert.equal(CANONICAL_PRODUCT_IDENTITY.currentMasterBrand, 'SunRey');
    assert.equal(LEGACY_MASTER_BRAND_ACTIVE, false);
    assert.equal(readFileSync(join(ROOT, 'AGENTS.md'), 'utf8').startsWith('# SunRey agent rules\n'), true);
    assert.equal(readFileSync(join(ROOT, 'README.md'), 'utf8').startsWith('# SunRey\n'), true);
  });

  it('canonical env name works and wins when only canonical is supplied', () => {
    const resolved = resolveCanonicalEnv(
      { canonicalName: 'SUNREY_PERSISTENCE_TEST', legacyName: 'SOLSTICE_PERSISTENCE_TEST' },
      { SUNREY_PERSISTENCE_TEST: '1' },
    );
    assert.equal(resolved.value, '1');
    assert.equal(resolved.source, 'CANONICAL');
    assert.equal(resolved.legacyAliasUsed, false);
    assert.equal(resolved.canonicalName, 'SUNREY_PERSISTENCE_TEST');
    assert.equal(CANONICAL_ENV_PREFIX, 'SUNREY_');
    assert.equal(isPersistenceTestEnabled({ SUNREY_PERSISTENCE_TEST: '1' }), true);
  });

  it('legacy env alias works when canonical is absent', () => {
    const resolved = resolveCanonicalEnv(
      { canonicalName: 'SUNREY_PG_HOST', legacyName: 'SOLSTICE_PG_HOST', defaultValue: '127.0.0.1' },
      { SOLSTICE_PG_HOST: '10.0.0.8' },
    );
    assert.equal(resolved.value, '10.0.0.8');
    assert.equal(resolved.source, 'LEGACY_ALIAS');
    assert.equal(resolved.legacyAliasUsed, true);
    assert.equal(isPersistenceTestEnabled({ SOLSTICE_PERSISTENCE_TEST: '1' }), true);
    assert.equal(LEGACY_ENV_COMPATIBILITY, true);
  });

  it('conflicting canonical and legacy env fails without logging secrets', () => {
    assert.throws(
      () =>
        resolveCanonicalEnv(
          { canonicalName: 'SUNREY_PG_HOST', legacyName: 'SOLSTICE_PG_HOST' },
          { SUNREY_PG_HOST: '127.0.0.1', SOLSTICE_PG_HOST: '10.0.0.8' },
        ),
      (error: unknown) => {
        assert.ok(error instanceof LegacyEnvConflictError);
        assert.equal(error.code, LEGACY_ENV_CONFLICT);
        assert.equal(error.message.includes('10.0.0.8'), false);
        assert.equal(error.message.includes('127.0.0.1'), false);
        return true;
      },
    );
    const secret = resolveCanonicalEnv(
      { canonicalName: 'SUNREY_PG_BOOTSTRAP_PASSWORD', legacyName: 'SOLSTICE_PG_BOOTSTRAP_PASSWORD', defaultValue: 'hidden' },
      { SUNREY_PG_BOOTSTRAP_PASSWORD: 'super-secret-value' },
    );
    const diagnostic = formatEnvResolutionDiagnostic(secret);
    assert.equal(diagnostic.includes('super-secret-value'), false);
    assert.equal(isSecretEnvName('SUNREY_PG_BOOTSTRAP_PASSWORD'), true);
    assert.match(formatPersistenceDiagnostic({
      level: 'info',
      code: 'ok',
      domain: 'bootstrap',
      message: 'ready',
    }), /^sunrey\.persistence /);
  });

  it('old env compatibility does not create a second config authority', () => {
    const env = persistenceEnvFromProcess({
      SUNREY_PG_HOST: '127.0.0.1',
      SUNREY_PG_PORT: '5432',
    });
    assert.equal(env.host, '127.0.0.1');
    assert.equal(env.port, 5432);
    const source = readFileSync(join(ROOT, 'packages/persistence/src/env.ts'), 'utf8');
    assert.match(source, /from '\.\.\/\.\.\/config\/src\/env\.ts'/);
    assert.equal(source.includes('env.SOLSTICE_PG_HOST ??'), false);
  });

  it('public CLI, SDK, and Explorer metadata say SunRey', async () => {
    const help = await runSunReyDev(['sunrey-dev', 'help']);
    assert.match(help, /SunRey SDK/);
    assert.match(explorerUsage(), /SunRey Explorer/);
    assert.equal(SUNREY_SDK_DISPLAY_NAME, 'SunRey SDK');
    assert.equal(SUNREY_CHAIN_DISPLAY_NAME, 'SunRey Chain');
    assert.equal(SUNREY_EXCHANGE_DISPLAY_NAME, 'SunRey Exchange');
    assert.deepEqual(SUNREY_PUBLIC_PRODUCT_METADATA, {
      sdk: 'SunRey SDK',
      chain: 'SunRey Chain',
      exchange: 'SunRey Exchange',
    });
    assert.equal(EXPLORER_PRODUCT_NAME, 'SunRey Explorer');
    assert.equal(EXPLORER_PRODUCT_BRAND, 'SunRey');
  });

  it('stable network, chain, and protocol asset IDs are unchanged', () => {
    assert.equal(PUBLIC_NETWORK_ID, 'net_sunrey_simulation');
    assert.equal(PUBLIC_CHAIN_ID, 'chn_sunrey_simulation');
    assert.equal(NETWORK_ID, 'net_sunrey_simulation');
    assert.equal(CHAIN_ID, 'chn_sunrey_simulation');
    assert.deepEqual([...PUBLIC_ASSET_IDS], ['SUNREY_COIN', 'MOONREY_COIN']);
    assert.equal(PROTOCOL_IDS_CHANGED, false);
  });

  it('historical events replay and fingerprints stay on stored identifiers', () => {
    assert.equal(EVENT_SCHEMA_REFS.AccountOpened, 'solstice.account.opened/1');
    assert.equal(EVENT_SCHEMA_REFS.IdentityCreated, 'solstice.identity.created/1');
    assert.equal(schemaRefFor('AccountOpened', 1), 'solstice.account.opened/1');
    const projection = projectEventSchemaRef('solstice.account.opened/1');
    assert.equal(projection.storedSchemaRef, 'solstice.account.opened/1');
    assert.equal(projection.historicalPrefix, true);
    assert.equal(projection.displayBrand, 'SunRey');
    assert.equal(schemaRefFor('FutureEvent', 1).startsWith('sunrey.'), true);
    assert.ok(HASH_DOMAINS.includes('SUNREY_TX_V1'));
    assert.equal(HISTORICAL_HASH_DOMAINS_CHANGED, false);
  });

  it('deprecated type alias references the same implementation', () => {
    const canonical = asSunReyIdentityId('idn_same');
    const alias = asSolsticeIdentityId('idn_same');
    assert.equal(canonical, alias);
    assert.equal(asSolsticeIdentityId, asSunReyIdentityId);
  });

  it('public legacy naming audit passes and repository path is unchanged', () => {
    const output = execFileSync('node', [join(ROOT, 'scripts/sunrey-naming-audit.mjs')], {
      encoding: 'utf8',
      cwd: ROOT,
    });
    assert.match(output, /sunrey-naming-audit: ok/);
    assert.equal(GITHUB_REPOSITORY_RENAMED, false);
    assert.equal(GITHUB_REPOSITORY_PATH, 'reyesnick54/solstice');
    assert.equal(existsSync(join(ROOT, 'docs/architecture/sunrey-naming-inventory.json')), true);
    const report = buildSunReyLegacyCompatibilityReport();
    assert.equal(report.publicLegacyDisplayNamesRemaining.length, 0);
    assert.equal(report.newPublicViolations.length, 0);
    assert.ok(report.legacyEnvAliasesRemaining.length > 0);
    assert.ok(report.legacyExportedAliasesRemaining.some((item) => item.legacyName === 'SolsticeIdentityId'));
  });

  it('architecture lint passes and ENVIRONMENT stays simulation', () => {
    const findings = lintConstitution(ROOT);
    assert.deepEqual(findings, []);
    const manifest = loadManifest(ROOT);
    const evaluation = evaluateChunkRequirements(
      manifest,
      ['architecture-linting', 'config', 'identity', 'persistence', 'event-fabric', 'sunrey-canonical-product-identity'],
      'CHUNK-142',
    );
    assert.equal(evaluation.mustStop, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    JSON.parse(readFileSync(join(ROOT, 'docs/architecture/manifest.json'), 'utf8'));
  });
});
