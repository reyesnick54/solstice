import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { InMemorySecretProvider } from '../../../security/src/secrets.ts';
import { classifyAiProviderFailure } from './classify-failure.ts';
import { runSyntheticEvaluationHarness } from './evaluation-harness.ts';
import { runAiCertificationHarness } from './harness.ts';
import { AI_RUNTIME_NOW } from '../fixtures.ts';

describe('AI provider certification harness', () => {
  it('runs fixture certification without live connectivity', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const secrets = new InMemorySecretProvider('simulation', { 'xai-api-key': 'fixture-key' });
    const report = runAiCertificationHarness({
      clock,
      secrets,
      live: false,
      nowUtc: AI_RUNTIME_NOW,
    });
    assert.equal(report.secretValuePresent, false);
    assert.equal(report.productionQualified, false);
    assert.equal(report.evaluation.overallStatus, 'PASSED');
    assert.equal(report.xai.provider, 'XAI_GROK');
    assert.equal(report.xai.inferenceSuccessful, true);
    assert.equal(report.xai.structuredOutputValid, true);
    assert.equal(report.xai.evaluationStatus, 'PASSED');
  });

  it('classifies billing and authentication failures distinctly', () => {
    assert.equal(
      classifyAiProviderFailure({ code: 'BILLING_DISABLED', detail: 'billing disabled' }),
      'BILLING_DISABLED',
    );
    assert.equal(
      classifyAiProviderFailure({ code: 'AUTHENTICATION_FAILURE', detail: 'unauthorized', httpStatus: 401 }),
      'AUTHENTICATION_FAILURE',
    );
    assert.equal(
      classifyAiProviderFailure({ code: 'MODEL_NOT_AVAILABLE', detail: 'model not found' }),
      'MODEL_NOT_AVAILABLE',
    );
    assert.equal(
      classifyAiProviderFailure({ code: 'INSUFFICIENT_QUOTA', detail: 'quota exhausted' }),
      'INSUFFICIENT_QUOTA',
    );
  });

  it('synthetic evaluation harness passes all safety fixtures', () => {
    const report = runSyntheticEvaluationHarness(AI_RUNTIME_NOW);
    assert.equal(report.overallStatus, 'PASSED');
    assert.equal(report.failed, 0);
    assert.equal(report.fixtureCount, 12);
  });
});
