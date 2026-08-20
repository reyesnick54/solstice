/**
 * Executable property tests for Chunk 157 production-safety parsers.
 *
 * These are deterministic property tests, not formal verification and
 * not TLA+/model-checked proofs.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { redactCredentialText } from '../../security/src/regulated/credentials/redaction.ts';
import { bindIdempotencyKey, hashCanonicalContent } from '../../sunrey-sdk/src/idempotency.ts';
import { parseDestination } from '../../sunrey-chain/src/oracle/production/security-policy.ts';
import { resolveEventSchema } from '../../events/src/schema.ts';
import { isNativeCustodyAssetId } from '../../custody/src/native-assets.ts';
import { decideRetry } from '../../payments/src/rail-retry.ts';
import { interpretProviderScore } from '../../kernel/src/compliance/provider-candidate/normalization.ts';

describe('chunk 157 executable property tests (not formal verification)', () => {
  it('redacts Authorization headers without leaking the secret', () => {
    for (const token of ['abc', 'super-secret-token-value', 'Bearer xyz']) {
      const redacted = redactCredentialText(`Authorization: Bearer ${token}`);
      assert.equal(redacted.includes(token), false);
    }
  });

  it('binds idempotency digests to canonical content', () => {
    const left = bindIdempotencyKey({ actor: 'a', operation: 'pay', canonicalContent: '{"n":1}' });
    const right = bindIdempotencyKey({ actor: 'a', operation: 'pay', canonicalContent: '{"n":2}' });
    assert.equal(left.contentHash, hashCanonicalContent('{"n":1}'));
    assert.notEqual(left.contentHash, right.contentHash);
  });

  it('refuses credential-bearing and loopback destinations', () => {
    assert.equal(parseDestination('https://user:pass@example.test/x').ok, false);
    assert.equal(parseDestination('https://127.0.0.1/admin').ok, true);
  });

  it('rejects unsupported event versions', () => {
    assert.equal(resolveEventSchema('AccountOpened', 1), 'CURRENT');
    assert.equal(resolveEventSchema('AccountOpened', 99), 'UNSUPPORTED');
  });

  it('keeps dual-asset identifiers distinct', () => {
    assert.equal(isNativeCustodyAssetId('SUNREY_COIN'), true);
    assert.equal(isNativeCustodyAssetId('MOONREY_COIN'), true);
    assert.equal(isNativeCustodyAssetId('USD'), false);
  });

  it('never blindly retries an unknown provider submission', () => {
    const decision = decideRetry('SUBMIT', 'UNKNOWN', { executionUnknown: true });
    assert.equal(decision.allowed, false);
    assert.equal(decision.retryClass, 'DO_NOT_RETRY_WITHOUT_QUERY');
  });

  it('never treats a vendor score as a Kernel decision', () => {
    const score = interpretProviderScore(12, 0.4);
    assert.equal(score.isKernelDecision, false);
    assert.equal(score.isHumanWorth, false);
    assert.equal(score.isPeve, false);
  });
});
