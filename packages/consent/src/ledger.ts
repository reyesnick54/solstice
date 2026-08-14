import { err, ok, type CustomerId, type Result, type UtcInstant } from '@solstice/domain';
import {
  assertKernelAuthorization,
  type KernelAuthorization,
} from '@solstice/kernel';

export type ConsentId = string;
export type DataRequestId = string;

export const CONTRIBUTION_DATA_CATEGORIES = [
  'WELLNESS',
  'ACTIVITY',
  'COHORT_DEMOGRAPHIC',
] as const;

export type ContributionDataCategory = (typeof CONTRIBUTION_DATA_CATEGORIES)[number];

export const CONSENT_STATES = [
  'OFFERED',
  'GRANTED',
  'DECLINED',
  'REVOKED',
  'EXPIRED',
] as const;

export type ConsentState = (typeof CONSENT_STATES)[number];

export type ConsentRecord = {
  readonly id: ConsentId;
  readonly customerId: CustomerId;
  readonly requestId: DataRequestId;
  readonly categories: readonly ContributionDataCategory[];
  readonly purpose: string;
  readonly jurisdiction: string;
  readonly status: ConsentState;
  readonly offeredAt: UtcInstant;
  readonly decidedAt?: UtcInstant;
  readonly revokedAt?: UtcInstant;
  readonly authorizationHash?: string;
};

export type ConsentError =
  | { readonly code: 'NOT_FOUND' }
  | { readonly code: 'NOT_ACTIVE'; readonly status: ConsentState }
  | { readonly code: 'ALREADY_DECIDED'; readonly status: ConsentState };

/**
 * Consent Ledger. Grant and revoke are Kernel-gated.
 * Records hold consent references only — never raw personal data.
 */
export class ConsentLedger {
  readonly #records = new Map<ConsentId, ConsentRecord>();
  readonly #byCustomer = new Map<string, ConsentId[]>();

  offer(input: {
    readonly id: ConsentId;
    readonly customerId: CustomerId;
    readonly requestId: DataRequestId;
    readonly categories: readonly ContributionDataCategory[];
    readonly purpose: string;
    readonly jurisdiction: string;
    readonly offeredAt: UtcInstant;
  }): ConsentRecord {
    const record: ConsentRecord = Object.freeze({
      id: input.id,
      customerId: input.customerId,
      requestId: input.requestId,
      categories: Object.freeze(input.categories.slice()),
      purpose: input.purpose,
      jurisdiction: input.jurisdiction,
      status: 'OFFERED',
      offeredAt: input.offeredAt,
    });
    this.#records.set(record.id, record);
    const list = this.#byCustomer.get(String(input.customerId)) ?? [];
    list.push(record.id);
    this.#byCustomer.set(String(input.customerId), list);
    return record;
  }

  /** @kernelGated */
  grantConsent(
    authorization: KernelAuthorization,
    consentId: ConsentId,
    at: UtcInstant,
  ): Result<ConsentRecord, ConsentError> {
    assertKernelAuthorization(authorization, 'GRANT_CONSENT');
    const current = this.#records.get(consentId);
    if (!current) return err({ code: 'NOT_FOUND' });
    if (current.status !== 'OFFERED') {
      return err({ code: 'ALREADY_DECIDED', status: current.status });
    }
    const next: ConsentRecord = Object.freeze({
      ...current,
      status: 'GRANTED',
      decidedAt: at,
      authorizationHash: authorization.permitHash,
    });
    this.#records.set(consentId, next);
    return ok(next);
  }

  /** @kernelGated */
  declineConsent(
    authorization: KernelAuthorization,
    consentId: ConsentId,
    at: UtcInstant,
  ): Result<ConsentRecord, ConsentError> {
    assertKernelAuthorization(authorization, 'GRANT_CONSENT');
    const current = this.#records.get(consentId);
    if (!current) return err({ code: 'NOT_FOUND' });
    if (current.status !== 'OFFERED') {
      return err({ code: 'ALREADY_DECIDED', status: current.status });
    }
    const next: ConsentRecord = Object.freeze({
      ...current,
      status: 'DECLINED',
      decidedAt: at,
      authorizationHash: authorization.permitHash,
    });
    this.#records.set(consentId, next);
    return ok(next);
  }

  /** @kernelGated */
  revokeConsent(
    authorization: KernelAuthorization,
    consentId: ConsentId,
    at: UtcInstant,
  ): Result<ConsentRecord, ConsentError> {
    assertKernelAuthorization(authorization, 'REVOKE_CONSENT');
    const current = this.#records.get(consentId);
    if (!current) return err({ code: 'NOT_FOUND' });
    if (current.status !== 'GRANTED') {
      return err({ code: 'NOT_ACTIVE', status: current.status });
    }
    const next: ConsentRecord = Object.freeze({
      ...current,
      status: 'REVOKED',
      revokedAt: at,
      authorizationHash: authorization.permitHash,
    });
    this.#records.set(consentId, next);
    return ok(next);
  }

  get(id: ConsentId): ConsentRecord | undefined {
    return this.#records.get(id);
  }

  isActive(id: ConsentId): boolean {
    return this.#records.get(id)?.status === 'GRANTED';
  }

  listForCustomer(customerId: CustomerId): readonly ConsentRecord[] {
    const ids = this.#byCustomer.get(String(customerId)) ?? [];
    return ids.map((id) => this.#records.get(id)).filter((row): row is ConsentRecord => row !== undefined);
  }

  list(): readonly ConsentRecord[] {
    return [...this.#records.values()];
  }
}
