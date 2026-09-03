import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';
import { handleConsumerBff, type ConsumerBffRuntime } from './consumer/handler.ts';
import { unwrapBff } from './consumer/bff-test-utils.ts';

function call(
  world: ReturnType<typeof createSandboxWorld>,
  method: string,
  path: string,
  persona: Parameters<typeof sandboxToken>[0],
  body?: Record<string, unknown>,
  query: Record<string, string> = {},
) {
  const runtime: ConsumerBffRuntime = {
    bff: world.bff,
    sessions: world.sessions,
    identity: world.runtime.identity.service,
    vault: world.vault,
  };
  return unwrapBff(handleConsumerBff(runtime, {
    method,
    path,
    query,
    body: body ?? {},
    authorization: `Bearer ${sandboxToken(persona)}`,
    requestId: `req_${method}_${path}`,
  }));
}

describe('Consumer BFF Personal Data Vault', () => {
  it('serves vault home, categories, and records for the owner', () => {
    const world = createSandboxWorld();
    const home = call(world, 'GET', '/api/v1/data/vault', 'vault_financial');
    assert.equal(home.status, 200);
    const body = home.body as { schema: string; recordCount: number; productionActive: boolean; sunreyOwnsUserData: boolean };
    assert.equal(body.schema, 'sunrey.consumer.vault.home.v1');
    assert.equal(body.productionActive, false);
    assert.equal(body.sunreyOwnsUserData, false);
    assert.ok(body.recordCount >= 1);
    const categories = call(world, 'GET', '/api/v1/data/vault/categories', 'vault_financial');
    assert.equal(categories.status, 200);
    const listed = call(world, 'GET', '/api/v1/data/vault/records', 'vault_financial');
    assert.equal(listed.status, 200);
    const items = (listed.body as { items: { dataRecordId: string; dataCategory: string }[] }).items;
    assert.ok(items.some((row) => row.dataCategory === 'financial'));
    const detail = call(world, 'GET', `/api/v1/data/vault/records/${items[0]!.dataRecordId}`, 'vault_financial');
    assert.equal(detail.status, 200);
    assert.equal((detail.body as { payloadRedacted: boolean }).payloadRedacted, true);
  });

  it('isolates customers and does not expose another vault', () => {
    const world = createSandboxWorld();
    const listed = call(world, 'GET', '/api/v1/data/vault/records', 'vault_minimal');
    assert.equal(listed.status, 200);
    const items = (listed.body as { items: { dataRecordId: string; dataCategory: string }[] }).items;
    assert.ok(items.every((row) => row.dataCategory === 'goals_preferences'));
    const financial = call(world, 'GET', '/api/v1/data/vault/records', 'vault_financial');
    const foreignId = (financial.body as { items: { dataRecordId: string }[] }).items[0]?.dataRecordId;
    assert.ok(foreignId);
    const stolen = call(world, 'GET', `/api/v1/data/vault/records/${foreignId}`, 'vault_minimal');
    assert.equal(stolen.status, 403);
  });

  it('corrects user-declared data and exports a portable bundle', () => {
    const world = createSandboxWorld();
    const listed = call(world, 'GET', '/api/v1/data/vault/records', 'vault_employment');
    const job = (listed.body as { items: { dataRecordId: string; dataKind: string }[] }).items.find(
      (row) => row.dataKind === 'USER_DECLARATION',
    );
    assert.ok(job);
    const patched = call(world, 'PATCH', `/api/v1/data/vault/records/${job.dataRecordId}`, 'vault_employment', {
      reason: 'title update',
      payload: { employer: 'Northwind Labs', title: 'Senior Analyst', startedOn: '2024-03-01' },
    });
    assert.equal(patched.status, 200);
    const exported = call(world, 'POST', '/api/v1/data/vault/export', 'vault_employment');
    assert.equal(exported.status, 202);
    const status = call(world, 'GET', '/api/v1/data/vault/export/status', 'vault_employment');
    assert.equal(status.status, 200);
    const jobId = (exported.body as { exportId: string }).exportId;
    const bundle = call(world, 'GET', `/api/v1/data/vault/export/${jobId}`, 'vault_employment');
    assert.equal(bundle.status, 200);
    assert.equal(JSON.stringify(bundle.body).includes('privateKey'), false);
  });

  it('shows disputed and revoked sandbox personas', () => {
    const world = createSandboxWorld();
    const disputed = call(world, 'GET', '/api/v1/data/vault', 'vault_disputed');
    assert.equal(disputed.status, 200);
    assert.ok((disputed.body as { disputedCount: number }).disputedCount >= 1);
    const revoked = call(world, 'GET', '/api/v1/data/vault/records', 'vault_revoked');
    assert.equal(revoked.status, 200);
    assert.equal((revoked.body as { items: unknown[] }).items.length, 0);
    const sources = call(world, 'GET', '/api/v1/data/vault/sources', 'vault_multi_source');
    assert.equal(sources.status, 200);
  });
});
