import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ConfigValidationError,
  LIVE_CONNECTIVITY_ENABLED,
  PRODUCTION_ACTIVE,
  PRODUCTION_READY,
  production_authorized,
  validatePlatformApiConfig,
} from './config.ts';

describe('platform API configuration', () => {
  it('accepts development defaults and keeps production flags false', () => {
    const config = validatePlatformApiConfig({});
    assert.equal(config.environment, 'simulation');
    assert.equal(config.apiBasePath, '/api/v1');
    assert.equal(config.deploymentTier, 'development');
    assert.equal(config.PRODUCTION_READY, false);
    assert.equal(config.PRODUCTION_ACTIVE, false);
    assert.equal(config.LIVE_CONNECTIVITY_ENABLED, false);
    assert.equal(config.production_authorized, false);
    assert.equal(PRODUCTION_READY, false);
    assert.equal(PRODUCTION_ACTIVE, false);
    assert.equal(LIVE_CONNECTIVITY_ENABLED, false);
    assert.equal(production_authorized, false);
  });

  it('fails closed on invalid production CORS and memory idempotency', () => {
    assert.throws(
      () =>
        validatePlatformApiConfig({
          deploymentTier: 'production',
          allowWildcardCors: true,
          allowedOrigins: ['*'],
          idempotencyBackend: 'injected',
        }),
      (error: unknown) => {
        assert.equal(error instanceof ConfigValidationError, true);
        if (error instanceof ConfigValidationError) {
          assert.equal(error.fieldErrors.some((row) => row.field === 'allowedOrigins'), true);
          assert.equal(error.fieldErrors.some((row) => row.field === 'idempotencyBackend'), true);
        }
        return true;
      },
    );
  });

  it('rejects a non-canonical API base path', () => {
    assert.throws(() => validatePlatformApiConfig({ apiBasePath: '/v1' }), ConfigValidationError);
  });

  it('rejects an unknown deployment tier', () => {
    assert.throws(() => validatePlatformApiConfig({ deploymentTier: 'live' }), ConfigValidationError);
  });
});
