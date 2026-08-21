import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PlatformApiError } from './errors.ts';
import { parseJsonBody, validateRequest } from './validation.ts';

describe('request validation', () => {
  it('accepts a valid mutation body before any domain work', () => {
    validateRequest(
      {
        params: { id: { kind: 'string', min: 1 } },
        query: { cursor: { kind: 'string', min: 1, max: 32 } },
        headers: { 'idempotency-key': { kind: 'string', min: 8 } },
        body: {
          kind: 'object',
          required: ['name'],
          properties: { name: { kind: 'string', min: 1 } },
        },
      },
      {
        params: { id: 'acct_1' },
        query: { cursor: 'c1' },
        headers: { 'idempotency-key': 'idem-key-1' },
        body: { name: 'ok' },
      },
    );
  });

  it('rejects missing body fields with fieldErrors', () => {
    assert.throws(
      () =>
        validateRequest(
          {
            body: {
              kind: 'object',
              required: ['name'],
              properties: { name: { kind: 'string', min: 1 } },
            },
          },
          { params: {}, query: {}, headers: {}, body: {} },
        ),
      (error: unknown) => {
        assert.equal(error instanceof PlatformApiError, true);
        if (error instanceof PlatformApiError) {
          assert.equal(error.code, 'VALIDATION_FAILED');
          assert.equal(error.fieldErrors[0]?.field, 'body.name');
        }
        return true;
      },
    );
  });

  it('rejects invalid JSON', () => {
    assert.throws(() => parseJsonBody('{'), (error: unknown) => {
      assert.equal(error instanceof PlatformApiError, true);
      if (error instanceof PlatformApiError) {
        assert.equal(error.code, 'INVALID_JSON');
      }
      return true;
    });
  });
});
