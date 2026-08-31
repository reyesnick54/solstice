import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dispatchBlockchain } from '../services/api/src/consumer/blockchain.ts';

describe('consumer BFF blockchain routes', () => {
  const headers = { 'cache-control': 'private, max-age=30' };

  it('GET /api/v1/blockchain/networks returns read-only simulation payload', () => {
    const res = dispatchBlockchain(
      { method: 'GET', path: '/api/v1/blockchain/networks' },
      'req_blockchain_networks',
      headers,
    );
    assert.ok(res);
    assert.equal(res!.status, 200);
    const body = res!.body as Record<string, unknown>;
    assert.equal(body.readOnly, true);
    assert.equal(body.simulation, true);
    assert.ok(Array.isArray(body.networks));
  });

  it('GET /api/v1/blockchain/networks/ethereum-mainnet/status', () => {
    const res = dispatchBlockchain(
      { method: 'GET', path: '/api/v1/blockchain/networks/ethereum-mainnet/status' },
      'req_blockchain_status',
      headers,
    );
    assert.ok(res);
    assert.equal(res!.status, 200);
  });

  it('does not expose generic RPC proxy POST', () => {
    const res = dispatchBlockchain(
      { method: 'POST', path: '/api/v1/blockchain/rpc' },
      'req_blockchain_rpc',
      headers,
    );
    assert.ok(res);
    assert.equal(res!.status, 404);
  });
});
