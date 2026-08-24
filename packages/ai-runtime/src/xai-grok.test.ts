import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { InMemorySecretProvider, secretRef } from '../../security/src/secrets.ts';
import { requestIdFor } from './ids.ts';
import { XaiGrokAiProvider } from './providers/xai-grok.ts';
import { CANONICAL_GROK_MODEL_ID, CANONICAL_GROK_MODEL_VERSION } from './registry.ts';
import { FixtureHttpsTransport, httpsOk } from './transport.ts';
import { AI_RUNTIME_NOW } from './fixtures.ts';
import type { CanonicalProviderRequest } from './types.ts';

function request(overrides: Partial<CanonicalProviderRequest> = {}): CanonicalProviderRequest {
  return Object.freeze({
    requestId: requestIdFor('prompt4:grok:test'),
    taskClass: 'GENERAL_ASSISTANT',
    modelRef: Object.freeze({
      modelId: CANONICAL_GROK_MODEL_ID,
      version: CANONICAL_GROK_MODEL_VERSION,
    }),
    promptHash: 'sha256:test-prompt',
    releasedContext: Object.freeze([]),
    purpose: 'GENERAL_ASSISTANT',
    ...overrides,
  });
}

describe('Prompt 4 xAI Grok provider binding', () => {
  it('maps the Responses API output into the canonical non-executing inference response', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const credentialRef = secretRef('simulation', 'xai-api-key');
    const secrets = new InMemorySecretProvider('simulation', { 'xai-api-key': 'xai-test-secret' });
    const transport = new FixtureHttpsTransport([
      {
        host: 'api.x.ai',
        path: '/v1/responses',
        result: httpsOk({
          output_text: 'SunRey sandbox explanation',
          usage: { input_tokens: 11, output_tokens: 7, total_tokens: 18 },
        }, 9),
      },
    ]);
    const provider = new XaiGrokAiProvider({
      clock,
      secrets,
      transport,
      config: { credentialRef },
    });

    const result = provider.infer(request());
    assert.equal(result.ok, true);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.providerKind, 'XAI_GROK');
    assert.equal(result.value.structured?.kind, 'EXPLANATION');
    assert.equal(result.value.grantsExecutionAuthority, false);
    assert.deepEqual(result.value.toolIntents, []);
    assert.equal(result.value.usage.totalTokens, 18);
    assert.equal(transport.observed.length, 1);
    assert.equal(transport.observed[0]?.body.model, 'grok-4.6');
    assert.equal(transport.observed[0]?.credentialRef?.href, 'secret://simulation/xai-api-key');
    assert.equal(JSON.stringify(transport.observed[0]).includes('xai-test-secret'), false);
  });

  it('requires HTTPS and a resolvable secret reference', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const missingSecrets = new XaiGrokAiProvider({
      clock,
      config: { credentialRef: 'secret://simulation/xai-api-key' },
    });
    const denied = missingSecrets.infer(request());
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'AUTHORIZATION_REQUIRED');
      assert.equal(denied.error.providerKind, 'XAI_GROK');
    }

    const secrets = new InMemorySecretProvider('simulation', { 'xai-api-key': 'xai-test-secret' });
    const nonTls = new XaiGrokAiProvider({
      clock,
      secrets,
      config: {
        baseUrl: 'http://api.x.ai',
        credentialRef: 'secret://simulation/xai-api-key',
      },
    });
    const blocked = nonTls.infer(request());
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.error.code, 'MODEL_POLICY_BLOCKED');
    }
  });

  it('never exposes execution capabilities', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const provider = new XaiGrokAiProvider(clock);
    const capabilities = provider.capabilities();
    assert.equal(capabilities.mayExecuteFinancialActions, false);
    assert.equal(capabilities.mayIssueExecutionAuthority, false);
    assert.equal(capabilities.mayReceivePrivateKeys, false);
    assert.equal(provider.health().healthy, false);
  });
});
