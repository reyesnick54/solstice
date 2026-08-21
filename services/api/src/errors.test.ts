import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { apiError, failClosedInternal, sanitizeClientMetadata } from './errors.ts';

describe('API error envelope', () => {
  it('includes stable fields and redacts sensitive metadata', () => {
    const envelope = apiError({
      code: 'VALIDATION_FAILED',
      message: 'bad input',
      requestId: 'req-1',
      fieldErrors: [{ field: 'body.name', code: 'REQUIRED', message: 'is required' }],
      metadata: { token: 'secret', safe: 'ok' },
    });
    assert.equal(envelope.error.code, 'VALIDATION_FAILED');
    assert.equal(envelope.error.category, 'VALIDATION');
    assert.equal(envelope.error.requestId, 'req-1');
    assert.equal(envelope.error.retryable, false);
    assert.equal(envelope.error.fieldErrors.length, 1);
    assert.equal(envelope.error.metadata.safe, 'ok');
    assert.equal(envelope.error.metadata.token, undefined);
    assert.equal('stack' in envelope.error, false);
  });

  it('does not leak internal details on unexpected failures', () => {
    const envelope = failClosedInternal('req-2');
    assert.equal(envelope.error.code, 'INTERNAL_ERROR');
    assert.equal(envelope.error.message.includes('stack'), false);
    assert.equal(envelope.error.category, 'INTERNAL');
  });

  it('drops sensitive metadata keys', () => {
    const sanitized = sanitizeClientMetadata({
      password: 'x',
      card_number: '4111111111111111',
      reason: 'amount_mismatch',
    });
    assert.deepEqual(sanitized, { reason: 'amount_mismatch' });
  });
});
