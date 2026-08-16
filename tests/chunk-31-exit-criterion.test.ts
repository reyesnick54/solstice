import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_CRYPTO_ENABLED, LIVE_EXCHANGE_ENABLED } from '../packages/config/src/flags.ts';
import { TICKER_STATUS } from '../packages/sunrey-coin/src/taxonomy.ts';
import { evaluateDeclaredChunks } from '../tools/architectural-linter/src/constitution.ts';
import { lintSunReyBlockchainArchitecture } from '../tools/architectural-linter/src/sunrey-blockchain-architecture-guards.ts';
import { evaluateCapability, loadManifest } from '../tools/architectural-linter/src/manifest.ts';

const ROOT = join(import.meta.dirname, '..');

const PROTOCOL_PATH = join(ROOT, 'docs/architecture/sunrey-blockchain-protocol.json');

const COMPETING = [
  'packages/sunrey-chain-v2',
  'packages/blockchain',
  'packages/reyn-chain',
  'packages/on-chain-ledger',
  'packages/crypto-chain',
  'packages/blockchain-node',
  'packages/blockchain-protocol',
  'packages/blockchain-network',
  'packages/blockchain-consensus',
  'packages/blockchain-runtime',
  'packages/sunrey-node',
  'packages/sunrey-blockchain',
  'packages/moonrey-chain',
  'packages/moonrey-coin',
] as const;

describe('Chunk 31 SunRey Blockchain production architecture freeze', () => {
  it('has exactly one canonical machine-readable architecture', () => {
    const findings = lintSunReyBlockchainArchitecture(ROOT);
    assert.deepEqual(findings, []);

    const protocol = JSON.parse(readFileSync(PROTOCOL_PATH, 'utf8')) as {
      id: string;
      canonicalOwner: string;
      productionBlockchainImplemented: boolean;
      mainnetEnabled: boolean;
      environment: string;
      secondFiatLedger: boolean;
      tickers: { sunreyCoin: string; moonreyCoin: string };
      nativeAssets: {
        sunreyCoin: { displayName: string; distinctFromMoonRey: boolean };
        moonreyCoin: { displayName: string; distinctFromSunReyCoin: boolean; implemented: boolean };
      };
      aiMustNot: readonly string[];
      legalStatusAutoPromote: boolean;
      counselStatus: string;
    };

    assert.equal(protocol.id, 'sunrey-blockchain-protocol');
    assert.equal(protocol.canonicalOwner, 'packages/sunrey-chain');
    assert.equal(protocol.productionBlockchainImplemented, false);
    assert.equal(protocol.mainnetEnabled, false);
    assert.equal(protocol.environment, 'simulation');
    assert.equal(protocol.secondFiatLedger, false);
    assert.equal(protocol.tickers.sunreyCoin, 'NOT_ASSIGNED');
    assert.equal(protocol.tickers.moonreyCoin, 'NOT_ASSIGNED');
    assert.equal(protocol.nativeAssets.sunreyCoin.displayName, 'SunRey Coin');
    assert.equal(protocol.nativeAssets.moonreyCoin.displayName, 'MoonRey Coin');
    assert.equal(protocol.nativeAssets.sunreyCoin.distinctFromMoonRey, true);
    assert.equal(protocol.nativeAssets.moonreyCoin.distinctFromSunReyCoin, true);
    assert.equal(protocol.nativeAssets.moonreyCoin.implemented, false);
    assert.equal(protocol.legalStatusAutoPromote, false);
    assert.equal(protocol.counselStatus, 'RESEARCH_REQUIRED');
    assert.equal(protocol.aiMustNot.includes('activate mainnet'), true);
    assert.equal(protocol.aiMustNot.includes('issue Execution Authority'), true);
    assert.equal(existsSync(join(ROOT, 'docs/architecture/sunrey-blockchain-protocol-v2.json')), false);
  });

  it('forbids competing blockchain packages and keeps tickers unassigned', () => {
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain')), true);
    for (const rel of COMPETING) {
      assert.equal(existsSync(join(ROOT, rel)), false, rel);
    }
    assert.equal(TICKER_STATUS, 'NOT_ASSIGNED');
    const coin = readFileSync(join(ROOT, 'packages/sunrey-coin/src/taxonomy.ts'), 'utf8');
    assert.equal(coin.includes("SUNREY_COIN_DISPLAY_NAME = 'SunRey Coin'"), true);
    assert.equal(/MoonRey Coin/.test(coin), false);
    const flags = readFileSync(join(ROOT, 'packages/config/src/flags.ts'), 'utf8');
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_CRYPTO_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(/MAINNET_ENABLED\s*=\s*true/.test(flags), false);
    assert.equal(/PRODUCTION_BLOCKCHAIN\s*=\s*true/.test(flags), false);
    assert.equal(/LIVE_CHAIN_ENABLED\s*=\s*true/.test(flags), false);
  });

  it('keeps ledger authority explicit and legal statuses from auto-promoting', () => {
    const matrix = readFileSync(join(ROOT, 'docs/architecture/sunrey-chain-authority-matrix.md'), 'utf8');
    assert.match(matrix, /Fiat deposits/);
    assert.match(matrix, /Canonical Ledger/);
    assert.match(matrix, /MoonRey Coin/);
    assert.match(matrix, /Ledger wins/i);
    assert.equal(/CONFIRMED_BY_COUNSEL/.test(matrix.split('Not `CONFIRMED_BY_COUNSEL`').join('')), false);

    const manifest = loadManifest(ROOT);
    const chainPkg = manifest.packages.find((pkg) => pkg.id === 'packages/sunrey-chain');
    assert.ok(chainPkg);
    assert.equal(chainPkg.financialStateMutation, false);
    assert.equal(evaluateCapability(manifest, 'sunrey-blockchain-architecture').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'moonrey-coin').status, 'PLANNED');
    assert.equal(evaluateCapability(manifest, 'blockchain-consensus').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'blockchain-consensus').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(ROOT, manifest).find((row) => row.chunk === 'CHUNK-31');
    assert.ok(declared, 'CHUNK-31 declaration must exist');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);
  });
});
