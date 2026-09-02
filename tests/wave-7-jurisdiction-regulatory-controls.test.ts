import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  buildJurisdictionContext,
  createRegulatoryControlEngine,
  DEFAULT_REGULATORY_PROFILES,
  jurisdictionSignal,
} from '../packages/kernel/src/regulatory-controls/index.ts';

const NOW = asUtcInstant('2026-09-02T12:00:00.000Z');

describe('Wave 7 jurisdiction and regulatory controls integration', () => {
  it('exports regulatory controls from kernel package', () => {
    assert.ok(createRegulatoryControlEngine);
    assert.ok(buildJurisdictionContext);
    assert.ok(DEFAULT_REGULATORY_PROFILES.length >= 10);
  });

  it('end-to-end evaluation produces auditable receipt chain', () => {
    const engine = createRegulatoryControlEngine();
    const context = buildJurisdictionContext({
      effectiveFrom: NOW,
      signals: [
        jurisdictionSignal('USER', 'GB', 'integration:user'),
        jurisdictionSignal('ENTITY', 'GB', 'integration:entity'),
        jurisdictionSignal('TRANSACTION', 'GB', 'integration:txn'),
      ],
    });

    const result = engine.evaluate({
      action: 'BANKING_TRANSFER',
      jurisdictionContext: context,
      regulatoryCategory: 'BANKING',
      regulatedFeature: 'BANKING_TRANSFER',
      storageRegion: 'UK_SOUTH',
      rightsGranted: true,
      consentGranted: true,
      environment: 'simulation',
      at: NOW,
    });

    assert.equal(result.outcome, 'ALLOW', result.reason);
    assert.ok(result.receipts.length >= 3);
    const kinds = new Set(result.receipts.map((receipt) => receipt.kind));
    assert.ok(kinds.has('JURISDICTION'));
    assert.ok(kinds.has('SERVICE_FEATURE_GATE'));
    assert.ok(kinds.has('DECISION'));
  });
});
