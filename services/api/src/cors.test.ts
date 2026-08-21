import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validatePlatformApiConfig } from './config.ts';
import { resolveCors } from './cors.ts';

describe('CORS origin policy', () => {
  it('reflects only configured origins and never wildcards production', () => {
    const config = validatePlatformApiConfig({
      deploymentTier: 'preview',
      allowedOrigins: ['https://app.sunrey.example'],
    });
    const allowed = resolveCors(config, 'https://app.sunrey.example');
    assert.equal(allowed.allowed, true);
    assert.equal(allowed.allowOrigin, 'https://app.sunrey.example');
    const denied = resolveCors(config, 'https://evil.example');
    assert.equal(denied.allowed, false);
    assert.equal(denied.allowOrigin, null);
  });

  it('allows localhost in development when no origins are configured', () => {
    const config = validatePlatformApiConfig({ deploymentTier: 'development', allowedOrigins: [] });
    const local = resolveCors(config, 'http://localhost:5173');
    assert.equal(local.allowed, true);
    const remote = resolveCors(config, 'https://preview.lovable.app');
    assert.equal(remote.allowed, false);
  });

  it('refuses wildcard CORS on the production tier', () => {
    assert.throws(() =>
      validatePlatformApiConfig({
        deploymentTier: 'production',
        allowedOrigins: ['*'],
        allowWildcardCors: true,
        idempotencyBackend: 'postgres',
      }),
    );
  });
});
