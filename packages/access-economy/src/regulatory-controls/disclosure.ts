/**
 * ACCESS Wave 5 — Disclosure registry and acknowledgment versioning.
 */

import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessDisclosureType } from './taxonomy.ts';
import type {
  AccessCheckoutDisclosureRequirement,
  AccessDisclosure,
  AccessDisclosureAcknowledgment,
  AccessDisclosureId,
  AccessDisclosureVersion,
  AccessPriceComponents,
} from './types.ts';

export const DEFAULT_ACCESS_DISCLOSURES: readonly AccessDisclosure[] = Object.freeze([
  disclosure('access-non-cash-right', '1.0.0', 'ACCESS_NON_CASH_RIGHT', 'GLOBAL', null, 'content:access-non-cash-right'),
  disclosure('capacity-limitation', '1.0.0', 'CAPACITY_LIMITATION', 'GLOBAL', null, 'content:capacity-limitation'),
  disclosure('funding-availability', '1.0.0', 'FUNDING_AVAILABILITY', 'GLOBAL', null, 'content:funding-availability'),
  disclosure('no-token-redemption', '1.0.0', 'NO_TOKEN_REDEMPTION', 'GLOBAL', null, 'content:no-token-redemption'),
  disclosure('user-copay', '1.0.0', 'USER_COPAY', 'GLOBAL', null, 'content:user-copay'),
  disclosure('security-deposit', '1.0.0', 'SECURITY_DEPOSIT', 'GLOBAL', null, 'content:security-deposit'),
  disclosure('cancellation-policy', '1.0.0', 'CANCELLATION_POLICY', 'GLOBAL', null, 'content:cancellation-policy'),
  disclosure('refund-policy', '1.0.0', 'REFUND_POLICY', 'GLOBAL', null, 'content:refund-policy'),
  disclosure('provider-terms', '1.0.0', 'PROVIDER_TERMS', 'GLOBAL', null, 'content:provider-terms'),
  disclosure('price-components', '1.0.0', 'PRICE_COMPONENTS', 'GLOBAL', null, 'content:price-components'),
  disclosure('service-provider-relationship', '1.0.0', 'SERVICE_PROVIDER_RELATIONSHIP', 'GLOBAL', null, 'content:service-provider-relationship'),
]);

function disclosure(
  id: string,
  version: string,
  type: AccessDisclosureType,
  jurisdiction: string,
  category: string | null,
  contentRef: string,
): AccessDisclosure {
  return Object.freeze({
    disclosureId: id,
    version,
    disclosureType: type,
    jurisdiction,
    category,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    requiredAcknowledgement: true,
    displayContentReference: contentRef,
    status: 'ACTIVE',
  });
}

export class AccessDisclosureRegistry {
  private readonly disclosures: Map<string, AccessDisclosure[]>;

  constructor(seed: readonly AccessDisclosure[] = DEFAULT_ACCESS_DISCLOSURES) {
    this.disclosures = new Map();
    for (const row of seed) {
      const existing = this.disclosures.get(row.disclosureId) ?? [];
      existing.push(row);
      this.disclosures.set(row.disclosureId, existing);
    }
  }

  getActive(disclosureId: AccessDisclosureId, at: UtcInstant): AccessDisclosure | undefined {
    const versions = this.disclosures.get(disclosureId) ?? [];
    const active = versions
      .filter((row) => row.status === 'ACTIVE' && row.effectiveFrom <= at)
      .sort((a, b) => (a.version < b.version ? 1 : -1));
    return active[0];
  }

  getVersion(disclosureId: AccessDisclosureId, version: AccessDisclosureVersion): AccessDisclosure | undefined {
    return (this.disclosures.get(disclosureId) ?? []).find((row) => row.version === version);
  }

  register(disclosure: AccessDisclosure): AccessDisclosure {
    const versions = this.disclosures.get(disclosure.disclosureId) ?? [];
    versions.push(disclosure);
    this.disclosures.set(disclosure.disclosureId, versions);
    return disclosure;
  }
}

export class AccessDisclosureAcknowledgmentStore {
  private readonly acknowledgments: AccessDisclosureAcknowledgment[] = [];

  record(input: {
    readonly disclosureId: AccessDisclosureId;
    readonly version: AccessDisclosureVersion;
    readonly userId: string;
    readonly transactionId: string | null;
    readonly acknowledgedAt: UtcInstant;
  }): AccessDisclosureAcknowledgment {
    const record: AccessDisclosureAcknowledgment = Object.freeze({
      acknowledgmentId: `ack_${randomUUID().replace(/-/g, '')}`,
      disclosureId: input.disclosureId,
      version: input.version,
      userId: input.userId,
      transactionId: input.transactionId,
      acknowledgedAt: input.acknowledgedAt,
    });
    this.acknowledgments.push(record);
    return record;
  }

  forTransaction(transactionId: string): readonly AccessDisclosureAcknowledgment[] {
    return Object.freeze(
      this.acknowledgments.filter((row) => row.transactionId === transactionId),
    );
  }

  all(): readonly AccessDisclosureAcknowledgment[] {
    return Object.freeze([...this.acknowledgments]);
  }
}

export function resolveCheckoutDisclosures(input: {
  readonly registry: AccessDisclosureRegistry;
  readonly at: UtcInstant;
  readonly jurisdiction: string;
  readonly category: string;
  readonly price: AccessPriceComponents;
  readonly fundingAvailabilityLimited: boolean;
  readonly hasSecurityDeposit: boolean;
  readonly hasProviderTerms: boolean;
}): readonly AccessCheckoutDisclosureRequirement[] {
  const requirements: AccessCheckoutDisclosureRequirement[] = [];
  const always = [
    'access-non-cash-right',
    'no-token-redemption',
    'funding-availability',
    'price-components',
    'service-provider-relationship',
  ] as const;

  for (const id of always) {
    const disclosure = input.registry.getActive(id, input.at);
    if (disclosure) {
      requirements.push(
        Object.freeze({ disclosure, reason: `required for all Access checkout: ${id}` }),
      );
    }
  }

  if (input.price.userContributionMinorUnits > 0n) {
    const disclosure = input.registry.getActive('user-copay', input.at);
    if (disclosure) {
      requirements.push(
        Object.freeze({
          disclosure,
          reason: `user contribution of ${input.price.userContributionMinorUnits} minor units`,
        }),
      );
    }
  }

  if (input.hasSecurityDeposit || input.price.depositMinorUnits > 0n) {
    const disclosure = input.registry.getActive('security-deposit', input.at);
    if (disclosure) {
      requirements.push(
        Object.freeze({
          disclosure,
          reason: 'provider may require a separate refundable deposit',
        }),
      );
    }
  }

  if (input.fundingAvailabilityLimited) {
    const disclosure = input.registry.getActive('capacity-limitation', input.at);
    if (disclosure) {
      requirements.push(
        Object.freeze({
          disclosure,
          reason: 'funded redemption availability is LIMITED while entitlement units may remain',
        }),
      );
    }
  }

  if (input.hasProviderTerms) {
    for (const id of ['provider-terms', 'cancellation-policy', 'refund-policy'] as const) {
      const disclosure = input.registry.getActive(id, input.at);
      if (disclosure) {
        requirements.push(
          Object.freeze({ disclosure, reason: `provider-specific terms: ${id}` }),
        );
      }
    }
  }

  return Object.freeze(requirements);
}
