import { createHash } from 'node:crypto';

import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import type { PaymentId } from './ids.ts';
import {
  asProviderId,
  asSettlementReference,
  asSettlementReportId,
  type ProviderId,
  type SettlementReference,
  type SettlementReportId,
} from './rail-ids.ts';

export type SettlementReportLine = {
  readonly paymentId: PaymentId;
  readonly settlementReference: SettlementReference;
  readonly amount: Money;
  readonly fee: Money;
};

export type SettlementReport = {
  readonly reportId: SettlementReportId;
  readonly provider: ProviderId;
  readonly settledAt: UtcInstant;
  readonly currency: CurrencyCode;
  readonly payments: readonly SettlementReportLine[];
  readonly fees: Money;
  readonly externalReference: SettlementReference;
  readonly grossAmount: Money;
  readonly netAmount: Money;
  readonly integrityHash: string;
};

export function buildSettlementReport(input: {
  readonly provider: string;
  readonly settledAt: UtcInstant;
  readonly currency: CurrencyCode;
  readonly payments: readonly SettlementReportLine[];
}): SettlementReport {
  let gross = 0n;
  let fees = 0n;
  for (const line of input.payments) {
    if (line.amount.currency !== input.currency || line.fee.currency !== input.currency) {
      throw new Error('settlement report lines must share one currency');
    }
    gross += line.amount.minorUnits;
    fees += line.fee.minorUnits;
  }
  const material = [
    input.provider,
    input.settledAt,
    input.currency,
    ...input.payments.map(
      (line) =>
        `${line.paymentId}:${line.settlementReference}:${line.amount.minorUnits.toString()}:${line.fee.minorUnits.toString()}`,
    ),
  ].join('|');
  const integrityHash = createHash('sha256').update(material).digest('hex');
  const reportId = asSettlementReportId(`srep_${integrityHash.slice(0, 24)}`);
  return Object.freeze({
    reportId,
    provider: asProviderId(input.provider),
    settledAt: input.settledAt,
    currency: input.currency,
    payments: Object.freeze(input.payments.map((line) => Object.freeze({ ...line }))),
    fees: Money.fromMinorUnits(fees, input.currency),
    externalReference: asSettlementReference(`ext_${reportId}`),
    grossAmount: Money.fromMinorUnits(gross, input.currency),
    netAmount: Money.fromMinorUnits(gross - fees, input.currency),
    integrityHash,
  });
}
