import type { OpenAccountPayload } from '@solstice/permissions';

import type { ValidatedExecutionAuthority } from './verify-authority.ts';

export const ACCOUNT_STATUSES = ['OPEN', 'FROZEN', 'CLOSED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/**
 * Account is constructed only from a validated Execution Authority.
 * The constructor is private. There is no public factory that accepts
 * raw fields, an unsigned token, or an optional authority.
 *
 * Balances are not stored. They are derived from the ledger.
 */
export class Account {
  readonly id: string;
  readonly ownerId: string;
  readonly accountClass: OpenAccountPayload['accountClass'];
  readonly productId: string;
  readonly legalEntityId: string;
  readonly jurisdiction: string;
  readonly currency: string;
  readonly status: AccountStatus;
  readonly openedAt: string;
  readonly version: number;
  readonly openedByAuthorityId: string;
  readonly openedByIntentId: string;

  private constructor(
    executionAuthority: ValidatedExecutionAuthority,
    payload: OpenAccountPayload,
    openedAt: string,
  ) {
    this.id = payload.accountId;
    this.ownerId = payload.ownerId;
    this.accountClass = payload.accountClass;
    this.productId = payload.productId;
    this.legalEntityId = payload.legalEntityId;
    this.jurisdiction = payload.jurisdiction;
    this.currency = payload.currency;
    this.status = 'OPEN';
    this.openedAt = openedAt;
    this.version = 0;
    this.openedByAuthorityId = executionAuthority.authorityId;
    this.openedByIntentId = executionAuthority.intentId;
    Object.freeze(this);
  }

  /**
   * The only function that can construct an Account. The first argument
   * is a ValidatedExecutionAuthority, which can be produced only by
   * verifyExecutionAuthority.
   */
  static fromValidatedAuthority(
    authority: ValidatedExecutionAuthority,
    payload: OpenAccountPayload,
    openedAt: string,
  ): Account {
    return new Account(authority as ValidatedExecutionAuthority, payload, openedAt);
  }
}

export type AccountOpenedV1 = {
  readonly eventType: 'AccountOpened';
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly ownerId: string;
  readonly accountClass: OpenAccountPayload['accountClass'];
  readonly productId: string;
  readonly legalEntityId: string;
  readonly jurisdiction: string;
  readonly currency: string;
  readonly authorityId: string;
  readonly intentId: string;
  readonly occurredAt: string;
};

export function accountOpenedV1(account: Account): AccountOpenedV1 {
  return Object.freeze({
    eventType: 'AccountOpened',
    schemaVersion: 1 as const,
    accountId: account.id,
    ownerId: account.ownerId,
    accountClass: account.accountClass,
    productId: account.productId,
    legalEntityId: account.legalEntityId,
    jurisdiction: account.jurisdiction,
    currency: account.currency,
    authorityId: account.openedByAuthorityId,
    intentId: account.openedByIntentId,
    occurredAt: account.openedAt,
  });
}
