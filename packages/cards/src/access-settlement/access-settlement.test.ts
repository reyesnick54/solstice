import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertNoSensitiveCardData } from '../pci-boundary.ts';
import { SandboxRestrictedCardIssuer } from './sandbox-restricted-card-issuer.ts';

describe('cards access-settlement sandbox issuer', () => {
  it('issues restricted virtual cards through SimulatedProductionCardIssuer', () => {
    const issuer = new SandboxRestrictedCardIssuer();
    const result = issuer.issueRestrictedCard({
      cardId: 'card_access_settlement_01',
      programId: 'sunrey-access-restricted-virtual',
      controls: Object.freeze({
        maximumAmountMinorUnits: 40_000n,
        singleTransaction: true,
        singleUse: true,
        expiresAt: '2026-09-01T12:00:00.000Z',
        merchantId: 'merchant_turo_us',
        allowedMerchantCategories: Object.freeze(['7512']),
        blockedMerchantCategories: Object.freeze([]),
        country: 'US',
        currency: 'USD',
        allowedMerchant: 'merchant_turo_us',
      }),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.metadata.displayHint, 'SIM-CARD');
      assert.equal(result.metadata.processorCardRef.startsWith('sim_tok_'), true);
      assertNoSensitiveCardData(result.metadata);
    }
    assert.equal(issuer.providerId, 'SIMULATED_CARD_PROCESSOR');
    assert.equal(issuer.lifecycle, 'SANDBOX');
  });

  it('closes card on disable', () => {
    const issuer = new SandboxRestrictedCardIssuer();
    const issued = issuer.issueRestrictedCard({
      cardId: 'card_access_settlement_02',
      programId: 'sunrey-access-restricted-virtual',
      controls: Object.freeze({
        maximumAmountMinorUnits: 10_000n,
        singleTransaction: true,
        singleUse: false,
        expiresAt: '2026-09-01T12:00:00.000Z',
        merchantId: null,
        allowedMerchantCategories: null,
        blockedMerchantCategories: Object.freeze([]),
        country: null,
        currency: 'USD',
        allowedMerchant: null,
      }),
    });
    assert.equal(issued.ok, true);
    if (!issued.ok) return;
    const disabled = issuer.disableCard(issued.metadata.processorCardRef);
    assert.equal(disabled?.status, 'CLOSED');
  });
});
