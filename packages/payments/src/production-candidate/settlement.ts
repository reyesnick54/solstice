import type { CurrencyCode } from '../../../domain/src/currency.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { Money } from '../../../money/src/money.ts';
import { asPaymentId } from '../ids.ts';
import { asSettlementReference } from '../rail-ids.ts';
import { buildSettlementReport, type SettlementReport, type SettlementReportLine } from '../rail-settlement-report.ts';

export type ProviderSettlementReportDto = {
  readonly providerSettlementDate: string;
  readonly currency: string;
  readonly grossAmountMinorUnits: string;
  readonly feeMinorUnits?: string;
  readonly transactionRefs: readonly string[];
  readonly providerSettlementRef: string;
  readonly paymentId: string;
};

export type NormalizedProviderSettlement = {
  readonly report: SettlementReport;
  readonly isLedgerSourceOfTruth: false;
  readonly providerSettlementDate: string;
  readonly providerSettlementRef: string;
};

export function normalizeProviderSettlementReport(
  provider: string,
  dto: ProviderSettlementReportDto,
  settledAt: UtcInstant,
): NormalizedProviderSettlement {
  const currency = dto.currency as CurrencyCode;
  const amount = Money.fromMinorUnits(BigInt(dto.grossAmountMinorUnits), currency);
  const fee = Money.fromMinorUnits(BigInt(dto.feeMinorUnits ?? '0'), currency);
  const line: SettlementReportLine = Object.freeze({
    paymentId: asPaymentId(dto.paymentId),
    settlementReference: asSettlementReference(dto.providerSettlementRef),
    amount,
    fee,
  });
  const report = buildSettlementReport({
    provider,
    settledAt,
    currency,
    payments: [line],
  });
  return Object.freeze({
    report,
    isLedgerSourceOfTruth: false,
    providerSettlementDate: dto.providerSettlementDate,
    providerSettlementRef: dto.providerSettlementRef,
  });
}
