import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  evaluateConsumerBffReadiness,
  persistenceConfigured,
  persistenceRequiredForReady,
} from './readiness.ts';

describe('Consumer BFF readiness', () => {
  it('does not require persistence by default', async () => {
    const report = await evaluateConsumerBffReadiness({
      ENVIRONMENT: 'simulation',
    });
    assert.equal(report.ready, true);
    assert.equal(report.productionActive, false);
    assert.equal(report.checks.find((row) => row.name === 'persistence')?.required, false);
  });

  it('fails closed when persistence is required but not configured', async () => {
    assert.equal(
      persistenceRequiredForReady({ SUNREY_FEATURE_REQUIRE_PERSISTENCE_FOR_READY: 'true' }),
      true,
    );
    assert.equal(persistenceConfigured({}), false);

    const report = await evaluateConsumerBffReadiness({
      ENVIRONMENT: 'simulation',
      SUNREY_FEATURE_REQUIRE_PERSISTENCE_FOR_READY: 'true',
    });
    assert.equal(report.ready, false);
    assert.equal(report.checks.find((row) => row.name === 'persistence')?.ok, false);
  });

  it('accepts SUNREY_API_REQUIRE_PERSISTENCE as an alias', async () => {
    const report = await evaluateConsumerBffReadiness({
      ENVIRONMENT: 'simulation',
      SUNREY_API_REQUIRE_PERSISTENCE: 'true',
    });
    assert.equal(report.ready, false);
    assert.equal(report.checks.find((row) => row.name === 'persistence')?.required, true);
  });
});
