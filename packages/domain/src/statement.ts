import { type Brand, brandAs } from './brand.ts';
import type { AccountId } from './account.ts';
import type { CurrencyCode } from './currency.ts';
import type { CustomerId } from './customer.ts';
import type { UtcInstant } from './time.ts';

export type StatementId = Brand<string, 'StatementId'>;

export function asStatementId(value: string): StatementId {
  if (value.length === 0) {
    throw new TypeError('StatementId must be a non-empty string');
  }
  return brandAs<string, 'StatementId'>(value);
}

export type StatementLine = {
  readonly journalId: string;
  readonly postedAt: UtcInstant;
  readonly direction: 'CREDIT' | 'DEBIT';
  readonly amountMinorUnits: bigint;
  readonly currency: CurrencyCode;
  readonly description: string;
  readonly transactionReference: string;
};

export type CustomerStatement = {
  readonly id: StatementId;
  readonly accountId: AccountId;
  readonly customerId: CustomerId;
  readonly currency: CurrencyCode;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly openingMinorUnits: bigint;
  readonly closingMinorUnits: bigint;
  readonly creditsMinorUnits: bigint;
  readonly debitsMinorUnits: bigint;
  readonly lines: readonly StatementLine[];
  readonly generatedAt: UtcInstant;
};

export function freezeStatement(statement: CustomerStatement): CustomerStatement {
  if (
    typeof statement.openingMinorUnits !== 'bigint' ||
    typeof statement.closingMinorUnits !== 'bigint'
  ) {
    throw new TypeError('statement positions must be bigint minor units');
  }
  return Object.freeze({
    ...statement,
    lines: Object.freeze(statement.lines.map((line) => Object.freeze({ ...line }))),
  });
}
