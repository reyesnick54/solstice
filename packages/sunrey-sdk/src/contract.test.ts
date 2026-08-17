import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { OPERATOR_ROUTES, PUBLIC_ROUTES, startPublicGateway } from './gateway/server.ts';
import { SunReyClient } from './clients.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function openApiPaths(file: string): string[] {
  const yaml = readFileSync(join(ROOT, file), 'utf8');
  return [...yaml.matchAll(/^  (\/v1\/[^\s:]+):$/gm)].map((match) => match[1] ?? '').filter(Boolean);
}

describe('SunRey API contract alignment', () => {
  it('keeps OpenAPI paths implemented on the public gateway', async () => {
    const chainPaths = openApiPaths('api/sunrey-chain-v1.openapi.yaml');
    const exchangePaths = openApiPaths('api/sunrey-exchange-v1.openapi.yaml');
    assert.ok(chainPaths.includes('/v1/chain/status'));
    assert.ok(chainPaths.includes('/v1/transactions'));
    assert.ok(chainPaths.includes('/v1/events'));
    assert.ok(exchangePaths.includes('/v1/exchange/markets'));
    const gateway = await startPublicGateway();
    try {
      for (const path of [
        '/v1/chain/status',
        '/v1/assets',
        '/v1/validators',
        '/v1/governance/proposals',
        '/v1/oracles/facts',
        '/v1/productive/moonrey',
        '/v1/productive/moonrey/policy',
        '/v1/productive/moonrey/supply-pressure',
        '/v1/machines',
        '/v1/interop/packets',
        '/v1/exchange/markets',
      ]) {
        const response = await fetch(`${gateway.url}${path}`);
        assert.equal(response.status, 200, path);
      }
    } finally {
      await gateway.close();
    }
  });

  it('documents SDK modules for every public namespace', () => {
    const proto = SunReyClient.prototype;
    assert.equal(typeof proto.status, 'function');
    assert.equal(typeof proto.submitTransaction, 'function');
    assert.equal(typeof proto.buildTransfer, 'function');
    const names = [
      'wallet',
      'assets',
      'fees',
      'validators',
      'governance',
      'oracles',
      'productive',
      'machines',
      'interop',
      'exchange',
      'events',
    ];
    for (const name of names) {
      assert.ok(name in new SunReyClient({
        baseUrl: 'http://127.0.0.1',
        get: async <T>() => ({}) as T,
        post: async <T>() => ({}) as T,
      }));
    }
    assert.ok(PUBLIC_ROUTES.includes('POST /v1/transactions'));
    assert.ok(OPERATOR_ROUTES.includes('POST /operator/v1/produce-block'));
  });

  it('Rust client crate declares the same public paths', () => {
    const rust = readFileSync(join(ROOT, 'packages/sunrey-chain/rust/crates/sdk/src/lib.rs'), 'utf8');
    for (const path of ['/v1/chain/status', '/v1/transactions', '/v1/events', '/v1/exchange/markets']) {
      assert.ok(rust.includes(path), path);
    }
    assert.ok(rust.includes('sunrey-ed25519-v1'));
    assert.ok(rust.includes('net_sunrey_simulation'));
  });
});
