import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isProductIntegrationDurableModeEnabled } from './product-durable-adapters.ts';

describe('product durable mode selection', () => {
  it('enables durable mode explicitly for hosted sandbox', () => {
    assert.equal(
      isProductIntegrationDurableModeEnabled({ SUNREY_PRODUCT_INTEGRATION_MODE: 'DURABLE' }),
      true,
    );
  });

  it('allows explicit in-memory mode for local/unit preview', () => {
    assert.equal(
      isProductIntegrationDurableModeEnabled({
        SUNREY_PRODUCT_INTEGRATION_MODE: 'IN_MEMORY',
        SUNREY_PERSISTENCE_TEST: '1',
      }),
      false,
    );
  });

  it('preserves persistence-test compatibility when no explicit mode is set', () => {
    assert.equal(isProductIntegrationDurableModeEnabled({ SUNREY_PERSISTENCE_TEST: '1' }), true);
  });
});
