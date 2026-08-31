/**
 * In-memory mock restricted card issuer for Access settlement tests.
 */

import { PCI_SENSITIVE_KEYS } from '../pci-keys.ts';
import {
  FULL_SIMULATED_CONTROL_SUPPORT,
  type RestrictedCardIssueInput,
  type RestrictedCardIssueResult,
  type RestrictedCardIssuerPort,
  type IssuerSafeCardMetadata,
} from '../issuer-port.ts';
import type { AccessCardControls } from '../types.ts';

function assertNoSensitiveFields(value: unknown, path = 'payload'): void {
  if (value === null || value === undefined || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      assertNoSensitiveFields(item, `${path}[${String(index)}]`);
    }
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((PCI_SENSITIVE_KEYS as readonly string[]).includes(key)) {
      throw new Error(`sensitive card field '${key}' is forbidden at ${path}.${key}`);
    }
    assertNoSensitiveFields(child, `${path}.${key}`);
  }
}

export class MockRestrictedCardIssuer implements RestrictedCardIssuerPort {
  readonly providerId = 'MOCK_RESTRICTED_CARD_ISSUER';
  readonly lifecycle = 'SIMULATED' as const;
  readonly controlSupport = FULL_SIMULATED_CONTROL_SUPPORT;

  private readonly cards = new Map<string, IssuerSafeCardMetadata>();
  private readonly controls = new Map<string, AccessCardControls>();
  private timeoutNext = false;
  private failNext = false;

  simulateTimeoutOnNextIssue(): void {
    this.timeoutNext = true;
  }

  simulateFailureOnNextIssue(): void {
    this.failNext = true;
  }

  issueRestrictedCard(input: RestrictedCardIssueInput): RestrictedCardIssueResult {
    if (this.timeoutNext) {
      this.timeoutNext = false;
      return { ok: false, code: 'ISSUER_TIMEOUT' };
    }
    if (this.failNext || input.cardId.includes('_fail_')) {
      this.failNext = false;
      return { ok: false, code: 'CARD_ISSUANCE_FAILED' };
    }
    const ref = `sim_tok_${input.cardId.replace(/-/g, '_')}`;
    const metadata: IssuerSafeCardMetadata = Object.freeze({
      processorCardRef: ref,
      formFactor: 'VIRTUAL',
      status: 'ACTIVE',
      displayHint: 'SIM-CARD',
      last4: '4242',
      expiryMonth: 12,
      expiryYear: 2099,
      issueOutcome: 'SUCCESS',
    });
    assertNoSensitiveFields(metadata);
    this.cards.set(ref, metadata);
    this.controls.set(ref, input.controls);
    return { ok: true, metadata };
  }

  applyControls(providerCardId: string, controls: AccessCardControls): IssuerSafeCardMetadata | undefined {
    const existing = this.cards.get(providerCardId);
    if (!existing) {
      return undefined;
    }
    this.controls.set(providerCardId, controls);
    return existing;
  }

  disableCard(providerCardId: string): IssuerSafeCardMetadata | undefined {
    const existing = this.cards.get(providerCardId);
    if (!existing) {
      return undefined;
    }
    const next: IssuerSafeCardMetadata = Object.freeze({
      ...existing,
      status: 'CLOSED',
    });
    this.cards.set(providerCardId, next);
    return next;
  }

  getControls(providerCardId: string): AccessCardControls | undefined {
    return this.controls.get(providerCardId);
  }
}
