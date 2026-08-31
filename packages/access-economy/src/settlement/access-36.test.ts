import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../../domain/src/time.ts';
import { providerRefFor } from '../ids.ts';
import { assertNoSensitiveCardPayload } from './pci-keys.ts';
import {
  AccessVirtualCardWebhookIngestor,
  DEFAULT_ACCESS_CARD_BUFFER_POLICY,
  InMemoryFundingReservationVerifier,
  MockRestrictedCardIssuer,
  ProductionRestrictedCardIssuerShell,
  RestrictedVirtualCardAccessRail,
  buildAccessCardControls,
  computeCardSpendingLimit,
  createRestrictedVirtualCardRail,
  createRestrictedVirtualCardRailWithIssuer,
  createAccessSettlementOrchestrator,
  fixtureVirtualCardRequest,
  FULL_SIMULATED_CONTROL_SUPPORT,
  productionCardIssuerChecklist,
  validateAccessCardControls,
  type WebhookGuardPort,
  type AccessWebhookEnvelope,
} from './index.ts';

const NOW = asUtcInstant('2026-08-31T12:00:00.000Z');
const EXPIRED = asUtcInstant('2025-01-01T00:00:00.000Z');
const WEBHOOK_SCHEMA_VERSION = 1;

class TestWebhookGuard implements WebhookGuardPort {
  private readonly secrets = new Map<string, string>();
  private readonly seen = new Set<string>();

  registerProvider(providerId: string, secret: string): void {
    this.secrets.set(providerId, secret);
  }

  sign(input: Omit<AccessWebhookEnvelope, 'signatureHex'>, secret: string): AccessWebhookEnvelope {
    void secret;
    return Object.freeze({ ...input, signatureHex: `sig_${input.idempotencyKey}` });
  }

  validate(
    envelope: AccessWebhookEnvelope,
    _nowMs: number,
  ): { readonly ok: true; readonly duplicate: boolean } | { readonly ok: false; readonly code: string } {
    void _nowMs;
    if (!this.secrets.has(envelope.providerId)) {
      return { ok: false, code: 'UNKNOWN_PROVIDER' };
    }
    if (envelope.signatureHex.startsWith('dead')) {
      return { ok: false, code: 'INVALID_SIGNATURE' };
    }
    const key = `${envelope.providerId}:${envelope.idempotencyKey}`;
    if (this.seen.has(key)) {
      return { ok: false, code: 'REPLAYED' };
    }
    this.seen.add(key);
    return { ok: true, duplicate: false };
  }
}

function setupRail() {
  const funding = new InMemoryFundingReservationVerifier();
  const rail = createRestrictedVirtualCardRail({
    issuer: new MockRestrictedCardIssuer(),
    fundingVerifier: funding,
  });
  return { funding, rail };
}

function reserveFunding(
  funding: InMemoryFundingReservationVerifier,
  request: ReturnType<typeof fixtureVirtualCardRequest>,
): void {
  funding.reserve({
    fundingReservationId: request.fundingReservationId,
    accessTransactionId: request.accessTransactionId,
    amountMinorUnits: request.accessPoolContributionMinorUnits + request.userFiatContributionMinorUnits,
    currency: request.currency,
  });
}

describe('ACCESS-36 restricted virtual-card settlement rail', () => {
  it('1. creates a restricted virtual card when funding is reserved', async () => {
    const { funding, rail } = setupRail();
    const request = fixtureVirtualCardRequest();
    reserveFunding(funding, request);
    const result = await rail.createVirtualCard(request);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.card.status, 'ACTIVE');
      assert.equal(result.card.last4, '4242');
      assertNoSensitiveCardPayload(result.card);
    }
  });

  it('2. enforces maximum amount control ($400 service)', async () => {
    const controls = buildAccessCardControls(
      fixtureVirtualCardRequest({ maximumAmount: 40_000n, category: 'MOBILITY' }),
      FULL_SIMULATED_CONTROL_SUPPORT,
    );
    assert.equal(controls.maximumAmountMinorUnits, 40_000n);
    assert.equal(computeCardSpendingLimit(40_000n, DEFAULT_ACCESS_CARD_BUFFER_POLICY), 40_000n);
  });

  it('3. enforces single-use control', async () => {
    const { funding, rail } = setupRail();
    const request = fixtureVirtualCardRequest({ singleUse: true });
    reserveFunding(funding, request);
    const created = await rail.createVirtualCard(request);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const approved = rail.validateAuthorization({
      cardId: created.card.cardId,
      settlementId: request.settlementId,
      merchantId: 'merchant_turo_us',
      merchantCategory: '7512',
      country: 'US',
      amountMinorUnits: 40_000n,
      currency: 'USD',
      now: NOW,
    });
    assert.equal(approved.ok, true);
    const card = rail.getCardStatus(created.card.cardId);
    assert.equal(card?.status, 'DISABLED');
  });

  it('4. declines authorization after card expiration', async () => {
    const { funding, rail } = setupRail();
    const request = fixtureVirtualCardRequest({ expiresAt: EXPIRED });
    reserveFunding(funding, request);
    const created = await rail.createVirtualCard(request);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const declined = rail.validateAuthorization({
      cardId: created.card.cardId,
      settlementId: request.settlementId,
      merchantId: 'merchant_turo_us',
      merchantCategory: '7512',
      country: 'US',
      amountMinorUnits: 40_000n,
      currency: 'USD',
      now: NOW,
    });
    assert.equal(declined.ok, false);
    if (!declined.ok) {
      assert.equal(declined.code, 'CARD_EXPIRED');
    }
  });

  it('5. enforces merchant restriction', async () => {
    const { funding, rail } = setupRail();
    const request = fixtureVirtualCardRequest({ merchantRestriction: 'merchant_turo_us' });
    reserveFunding(funding, request);
    const created = await rail.createVirtualCard(request);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const wrongMerchant = rail.validateAuthorization({
      cardId: created.card.cardId,
      settlementId: request.settlementId,
      merchantId: 'merchant_unrelated',
      merchantCategory: '7512',
      country: 'US',
      amountMinorUnits: 40_000n,
      currency: 'USD',
      now: NOW,
    });
    assert.equal(wrongMerchant.ok, false);
    if (!wrongMerchant.ok) {
      assert.equal(wrongMerchant.code, 'MERCHANT_NOT_ALLOWED');
    }
  });

  it('6. enforces MCC restriction for category', async () => {
    const { funding, rail } = setupRail();
    const request = fixtureVirtualCardRequest({ category: 'MOBILITY' });
    reserveFunding(funding, request);
    const created = await rail.createVirtualCard(request);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const wrongMcc = rail.validateAuthorization({
      cardId: created.card.cardId,
      settlementId: request.settlementId,
      merchantId: 'merchant_turo_us',
      merchantCategory: '5812',
      country: 'US',
      amountMinorUnits: 40_000n,
      currency: 'USD',
      now: NOW,
    });
    assert.equal(wrongMcc.ok, false);
    if (!wrongMcc.ok) {
      assert.equal(wrongMcc.code, 'MCC_NOT_ALLOWED');
    }
  });

  it('7. enforces geographic restriction', async () => {
    const { funding, rail } = setupRail();
    const request = fixtureVirtualCardRequest({ countryRestriction: 'US' });
    reserveFunding(funding, request);
    const created = await rail.createVirtualCard(request);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const wrongCountry = rail.validateAuthorization({
      cardId: created.card.cardId,
      settlementId: request.settlementId,
      merchantId: 'merchant_turo_us',
      merchantCategory: '7512',
      country: 'GB',
      amountMinorUnits: 40_000n,
      currency: 'USD',
      now: NOW,
    });
    assert.equal(wrongCountry.ok, false);
    if (!wrongCountry.ok) {
      assert.equal(wrongCountry.code, 'COUNTRY_NOT_ALLOWED');
    }
  });

  it('8. approves correct $400 authorization', async () => {
    const { funding, rail } = setupRail();
    const request = fixtureVirtualCardRequest({
      maximumAmount: 40_000n,
      singleUse: false,
    });
    reserveFunding(funding, request);
    const created = await rail.createVirtualCard(request);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const approved = rail.validateAuthorization({
      cardId: created.card.cardId,
      settlementId: request.settlementId,
      merchantId: 'merchant_turo_us',
      merchantCategory: '7512',
      country: 'US',
      amountMinorUnits: 40_000n,
      currency: 'USD',
      now: NOW,
    });
    assert.equal(approved.ok, true);
  });

  it('9. declines unauthorized $500 charge', async () => {
    const { funding, rail } = setupRail();
    const request = fixtureVirtualCardRequest({ maximumAmount: 40_000n, singleUse: false });
    reserveFunding(funding, request);
    const created = await rail.createVirtualCard(request);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const declined = rail.validateAuthorization({
      cardId: created.card.cardId,
      settlementId: request.settlementId,
      merchantId: 'merchant_turo_us',
      merchantCategory: '7512',
      country: 'US',
      amountMinorUnits: 50_000n,
      currency: 'USD',
      now: NOW,
    });
    assert.equal(declined.ok, false);
    if (!declined.ok) {
      assert.equal(declined.code, 'AMOUNT_EXCEEDS_LIMIT');
    }
  });

  it('10. declines unrelated merchant', async () => {
    const result = validateAccessCardControls({
      controls: buildAccessCardControls(
        fixtureVirtualCardRequest({ merchantRestriction: 'merchant_a' }),
        FULL_SIMULATED_CONTROL_SUPPORT,
      ),
      cardStatus: 'ACTIVE',
      merchantId: 'merchant_b',
      merchantCategory: '7512',
      country: 'US',
      amountMinorUnits: 10_000n,
      currency: 'USD',
      now: NOW,
      aggregateAuthorizedMinorUnits: 0n,
      authorizationCount: 0,
    });
    assert.equal(result.allowed, false);
    if (!result.allowed) {
      assert.equal(result.code, 'MERCHANT_NOT_ALLOWED');
    }
  });

  it('11. rejects security deposit on Access card', async () => {
    const { funding, rail } = setupRail();
    const request = fixtureVirtualCardRequest({ securityDepositRequired: true });
    reserveFunding(funding, request);
    const blocked = await rail.createVirtualCard(request);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.code, 'UNSUPPORTED_ACCESS_PAYMENT_CONFIGURATION');
    }
    const depositAuth = validateAccessCardControls({
      controls: buildAccessCardControls(fixtureVirtualCardRequest(), FULL_SIMULATED_CONTROL_SUPPORT),
      cardStatus: 'ACTIVE',
      merchantId: 'merchant_turo_us',
      merchantCategory: '7011',
      country: 'US',
      amountMinorUnits: 10_000n,
      currency: 'USD',
      now: NOW,
      aggregateAuthorizedMinorUnits: 0n,
      authorizationCount: 0,
      securityDepositAttempt: true,
    });
    assert.equal(depositAuth.allowed, false);
    if (!depositAuth.allowed) {
      assert.equal(depositAuth.code, 'SECURITY_DEPOSIT_NOT_FUNDED');
    }
  });

  it('12. bounds incremental authorization', async () => {
    const { funding, rail } = setupRail();
    const request = fixtureVirtualCardRequest({ maximumAmount: 40_000n, singleUse: false });
    reserveFunding(funding, request);
    const created = await rail.createVirtualCard(request);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const first = rail.validateAuthorization({
      cardId: created.card.cardId,
      settlementId: request.settlementId,
      merchantId: 'merchant_turo_us',
      merchantCategory: '7512',
      country: 'US',
      amountMinorUnits: 25_000n,
      currency: 'USD',
      incremental: true,
      now: NOW,
    });
    assert.equal(first.ok, true);
    const second = rail.validateAuthorization({
      cardId: created.card.cardId,
      settlementId: request.settlementId,
      merchantId: 'merchant_turo_us',
      merchantCategory: '7512',
      country: 'US',
      amountMinorUnits: 20_000n,
      currency: 'USD',
      incremental: true,
      now: NOW,
    });
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, 'INCREMENTAL_AUTH_EXCEEDS_MAX');
    }
  });

  it('13. disables compromised card immediately', async () => {
    const { funding, rail } = setupRail();
    const request = fixtureVirtualCardRequest({ singleUse: false });
    reserveFunding(funding, request);
    const created = await rail.createVirtualCard(request);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const disabled = rail.disableCard({ cardId: created.card.cardId, reason: 'compromised', now: NOW });
    assert.equal(disabled.ok, true);
    if (disabled.ok) {
      assert.equal(disabled.card.status, 'DISABLED');
    }
  });

  it('14. handles issuer timeout', async () => {
    const funding = new InMemoryFundingReservationVerifier();
    const issuer = new MockRestrictedCardIssuer();
    issuer.simulateTimeoutOnNextIssue();
    const rail = new RestrictedVirtualCardAccessRail({ issuer, fundingVerifier: funding });
    const request = fixtureVirtualCardRequest();
    reserveFunding(funding, request);
    const result = await rail.createVirtualCard(request);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'ISSUER_TIMEOUT');
    }
  });

  it('15. verifies webhook signatures and rejects unsigned events', () => {
    const ingestor = new AccessVirtualCardWebhookIngestor(new TestWebhookGuard());
    ingestor.registerProvider('MOCK_RESTRICTED_CARD_ISSUER', 'whsec_access_test');
    const refused = ingestor.ingest({
      envelope: {
        schemaVersion: WEBHOOK_SCHEMA_VERSION,
        providerId: 'MOCK_RESTRICTED_CARD_ISSUER',
        eventType: 'access.card.created',
        timestampUtc: '2026-08-31T12:00:00.000Z',
        nonce: 'n1',
        idempotencyKey: 'k1',
        payloadHash: 'h1',
        signatureHex: 'deadbeef',
      },
      payload: { settlementId: 'stl_1', cardId: 'avc_1' },
      nowMs: Date.parse('2026-08-31T12:00:00.000Z'),
      verificationRequired: false,
    });
    assert.equal(refused.accepted, false);
    if (!refused.accepted) {
      assert.equal(refused.code, 'WEBHOOK_SIGNATURE_INVALID');
    }
  });

  it('16. detects duplicate webhook delivery', () => {
    const guard = new TestWebhookGuard();
    const ingestor = new AccessVirtualCardWebhookIngestor(guard);
    ingestor.registerProvider('MOCK_RESTRICTED_CARD_ISSUER', 'whsec_access_dup');
    const signed = ingestor.sign(
      {
        schemaVersion: WEBHOOK_SCHEMA_VERSION,
        providerId: 'MOCK_RESTRICTED_CARD_ISSUER',
        eventType: 'access.card.captured',
        timestampUtc: '2026-08-31T12:00:00.000Z',
        nonce: 'n_dup',
        idempotencyKey: 'k_dup',
        payloadHash: 'h_dup',
      },
      'whsec_access_dup',
    );
    const first = ingestor.ingest({
      envelope: signed,
      payload: { settlementId: 'stl_dup', cardId: 'avc_dup' },
      nowMs: Date.parse('2026-08-31T12:00:00.000Z'),
    });
    assert.equal(first.accepted, true);
    const duplicate = ingestor.ingest({
      envelope: signed,
      payload: { settlementId: 'stl_dup', cardId: 'avc_dup' },
      nowMs: Date.parse('2026-08-31T12:00:00.000Z'),
    });
    assert.equal(duplicate.accepted, false);
    if (!duplicate.accepted) {
      assert.equal(duplicate.code, 'DUPLICATE_WEBHOOK');
    }
  });

  it('17. captures authorized amount', async () => {
    const { funding, rail } = setupRail();
    const request = fixtureVirtualCardRequest({ singleUse: false });
    reserveFunding(funding, request);
    const created = await rail.createVirtualCard(request);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const auth = rail.validateAuthorization({
      cardId: created.card.cardId,
      settlementId: request.settlementId,
      merchantId: 'merchant_turo_us',
      merchantCategory: '7512',
      country: 'US',
      amountMinorUnits: 40_000n,
      currency: 'USD',
      now: NOW,
    });
    assert.equal(auth.ok, true);
    if (!auth.ok) return;
    const captured = rail.capture({
      authorizationId: auth.authorization.authorizationId,
      amountMinorUnits: 40_000n,
      now: NOW,
    });
    assert.equal(captured.ok, true);
    if (captured.ok) {
      assert.equal(captured.capture.amountMinorUnits, 40_000n);
    }
  });

  it('18. reverses authorization', async () => {
    const { funding, rail } = setupRail();
    const request = fixtureVirtualCardRequest({ singleUse: false });
    reserveFunding(funding, request);
    const created = await rail.createVirtualCard(request);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const auth = rail.validateAuthorization({
      cardId: created.card.cardId,
      settlementId: request.settlementId,
      merchantId: 'merchant_turo_us',
      merchantCategory: '7512',
      country: 'US',
      amountMinorUnits: 40_000n,
      currency: 'USD',
      now: NOW,
    });
    assert.equal(auth.ok, true);
    if (!auth.ok) return;
    const reversed = rail.voidAuthorization({
      authorizationId: auth.authorization.authorizationId,
      now: NOW,
    });
    assert.equal(reversed.ok, true);
  });

  it('19. refunds captured amount', async () => {
    const { funding, rail } = setupRail();
    const request = fixtureVirtualCardRequest({ singleUse: false });
    reserveFunding(funding, request);
    const created = await rail.createVirtualCard(request);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const auth = rail.validateAuthorization({
      cardId: created.card.cardId,
      settlementId: request.settlementId,
      merchantId: 'merchant_turo_us',
      merchantCategory: '7512',
      country: 'US',
      amountMinorUnits: 40_000n,
      currency: 'USD',
      now: NOW,
    });
    assert.equal(auth.ok, true);
    if (!auth.ok) return;
    const captured = rail.capture({
      authorizationId: auth.authorization.authorizationId,
      amountMinorUnits: 40_000n,
      now: NOW,
    });
    assert.equal(captured.ok, true);
    if (!captured.ok) return;
    const refunded = rail.refund({
      captureId: captured.capture.captureId,
      amountMinorUnits: 40_000n,
      now: NOW,
    });
    assert.equal(refunded.ok, true);
    if (refunded.ok) {
      assert.equal(refunded.amountMinorUnits, 40_000n);
    }
  });

  it('20. reconciles AccessSettlement chain', async () => {
    const { funding, rail } = setupRail();
    const request = fixtureVirtualCardRequest({ singleUse: false });
    reserveFunding(funding, request);
    const created = await rail.createVirtualCard(request);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const auth = rail.validateAuthorization({
      cardId: created.card.cardId,
      settlementId: request.settlementId,
      merchantId: 'merchant_turo_us',
      merchantCategory: '7512',
      country: 'US',
      amountMinorUnits: 40_000n,
      currency: 'USD',
      now: NOW,
    });
    assert.equal(auth.ok, true);
    if (!auth.ok) return;
    rail.capture({
      authorizationId: auth.authorization.authorizationId,
      amountMinorUnits: 40_000n,
      now: NOW,
    });
    const recon = rail.reconcile(request.settlementId, NOW);
    assert.ok(recon);
    assert.equal(recon!.accessTransactionId, request.accessTransactionId);
    assert.equal(recon!.settlementId, request.settlementId);
    assert.equal(recon!.cardId, created.card.cardId);
    assert.equal(recon!.capturedAmountMinorUnits, 40_000n);
    assert.equal(recon!.fundingReservationId, request.fundingReservationId);
  });

  it('21. stores no raw PAN in card records', async () => {
    const { funding, rail } = setupRail();
    const request = fixtureVirtualCardRequest();
    reserveFunding(funding, request);
    const created = await rail.createVirtualCard(request);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.card.last4, '4242');
    assert.equal(created.card.providerCardId.startsWith('sim_tok_'), true);
    assertNoSensitiveCardPayload(created.card);
  });

  it('22. forbids SR/MR card funding', async () => {
    const { funding, rail } = setupRail();
    const request = fixtureVirtualCardRequest({ tokenConversionContributionMinorUnits: 100n });
    reserveFunding(funding, request);
    const blocked = await rail.createVirtualCard(request);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.code, 'TOKEN_FUNDING_FORBIDDEN');
    }
  });

  it('23. requires funding reservation before card use', async () => {
    const funding = new InMemoryFundingReservationVerifier();
    const rail = createRestrictedVirtualCardRail({
      issuer: new MockRestrictedCardIssuer(),
      fundingVerifier: funding,
    });
    const request = fixtureVirtualCardRequest();
    const blocked = await rail.createVirtualCard(request);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.code, 'FUNDING_NOT_RESERVED');
    }
  });

  it('24. blocks production when credentials absent', async () => {
    const funding = new InMemoryFundingReservationVerifier();
    const shell = new ProductionRestrictedCardIssuerShell();
    const rail = new RestrictedVirtualCardAccessRail({ issuer: shell, fundingVerifier: funding });
    assert.equal(rail.status, 'BLOCKED_PENDING_PROVIDER');
    const checklist = productionCardIssuerChecklist();
    assert.equal(checklist.liveEnabled, false);
    assert.equal(checklist.requirements.every((r) => r.satisfied === false), true);
    const request = fixtureVirtualCardRequest();
    reserveFunding(funding, request);
    const blocked = await rail.createVirtualCard(request);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.code, 'PROVIDER_BLOCKED');
    }
  });

  it('orchestrator wires injected sandbox issuer through settlement flow', async () => {
    const funding = new InMemoryFundingReservationVerifier();
    const sandboxIssuer: import('./issuer-port.ts').RestrictedCardIssuerPort = Object.freeze({
      providerId: 'SIMULATED_CARD_PROCESSOR',
      lifecycle: 'SANDBOX',
      controlSupport: FULL_SIMULATED_CONTROL_SUPPORT,
      issueRestrictedCard: (input) => new MockRestrictedCardIssuer().issueRestrictedCard(input),
      applyControls: (id, controls) => new MockRestrictedCardIssuer().applyControls(id, controls),
      disableCard: (id) => new MockRestrictedCardIssuer().disableCard(id),
    });
    const rail = createRestrictedVirtualCardRailWithIssuer({
      mode: 'sandbox',
      fundingVerifier: funding,
      sandboxIssuer,
    });
    const orchestrator = createAccessSettlementOrchestrator({ rail });
    const request = fixtureVirtualCardRequest({ providerId: providerRefFor('expedia'), category: 'LODGING' });
    reserveFunding(funding, request);
    const result = await orchestrator.settleWithVirtualCard(request);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(orchestrator.getRail().status, 'SANDBOX');
    }
  });
});
