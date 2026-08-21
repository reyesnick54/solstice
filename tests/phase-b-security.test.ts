import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { createMemoryTokenStore, createSunReyConsumerClient } from '../packages/sunrey-sdk/src/consumer-platform/index.ts';
import { startConsumerPlatform } from '../services/consumer-platform/src/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Phase B public surface security', () => {
  it('does not leak secrets, stack traces, or privileged URLs on errors', async () => {
    const platform = await startConsumerPlatform({
      allowSandboxPersonas: true,
      integrationEnvironment: 'TEST',
    });
    const client = createSunReyConsumerClient({
      baseUrl: platform.url,
      auth: createMemoryTokenStore(),
    });
    try {
      const response = await fetch(`${platform.url}/v1/consumer/home`);
      const body = await response.text();
      assert.equal(response.status, 401);
      assert.equal(body.includes('stack'), false);
      assert.equal(body.includes('BEGIN PRIVATE KEY'), false);
      assert.equal(body.includes('postgres://'), false);
      assert.equal(body.includes('AuthorityIssuer'), false);
    } finally {
      await platform.close();
    }
    void client;
    const spec = readFileSync(join(ROOT, 'api/sunrey-consumer-platform-v1.openapi.yaml'), 'utf8');
    assert.equal(/sk_live_|AKIA[0-9A-Z]{16}|BEGIN PRIVATE KEY/.test(spec), false);
  });
});
