import type { CustomerId, UtcInstant } from '@solstice/domain';
import type { CashBalanceState, BuyingPowerState, FinancingAllocationCaps } from './types.ts';
import { HELIOS_EXEC10_SCHEMA, type GrowFinancingPostureFlag } from './taxonomy.ts';
import { computeEffectiveBuyingPower } from './effective-buying-power.ts';

export type BuildBuyingPowerInput = {
  readonly customerId: CustomerId;
  readonly brokerageAccountId: string;
  readonly currency: string;
  readonly providerId: string;
  readonly brokerReportedAvailableMinor: string;
  readonly caps: FinancingAllocationCaps;
  readonly cash: CashBalanceState;
  readonly posture: readonly GrowFinancingPostureFlag[];
  readonly asOf: UtcInstant;
};

/**
 * Provider-reported buying power is informational until validated against mandate and Risk.
 * Under CASH_ONLY, broker amounts above settled availability cannot increase executable power.
 */
export function buildBuyingPowerState(input: BuildBuyingPowerInput): BuyingPowerState {
  const brokerReported = BigInt(input.brokerReportedAvailableMinor);
  const cashCap = BigInt(input.cash.availableToTradeMinor);

  let brokerAvailableForCaps = brokerReported;
  let limitingSource: BuyingPowerState['limitingSource'] = 'BROKER';

  if (input.posture.includes('CASH_ONLY') && brokerReported > cashCap) {
    brokerAvailableForCaps = cashCap;
    limitingSource = 'CASH_POSTURE';
  }

  const capsForMin: FinancingAllocationCaps = Object.freeze({
    brokerAvailableMinor: brokerAvailableForCaps.toString(),
    sunreyCapitalAllocationMinor: input.caps.sunreyCapitalAllocationMinor,
    riskAllocationMinor: input.caps.riskAllocationMinor,
    customerMandateMinor: input.caps.customerMandateMinor,
  });

  const effective = computeEffectiveBuyingPower(capsForMin);
  if (limitingSource === 'CASH_POSTURE' && effective.limitingSource === 'BROKER') {
    limitingSource = 'CASH_POSTURE';
  } else {
    limitingSource = effective.limitingSource;
  }

  return Object.freeze({
    schemaVersion: HELIOS_EXEC10_SCHEMA,
    customerId: input.customerId,
    brokerageAccountId: input.brokerageAccountId,
    currency: input.currency,
    providerId: input.providerId,
    brokerReportedAvailableMinor: input.brokerReportedAvailableMinor,
    validationState: 'MANDATE_VALIDATED',
    executableBuyingPowerMinor: effective.executableBuyingPowerMinor,
    limitingSource,
    asOf: input.asOf,
  });
}

export function providerBuyingPowerInformationalOnly(input: {
  readonly brokerReportedAvailableMinor: string;
  readonly executableBuyingPowerMinor: string;
  readonly posture: readonly GrowFinancingPostureFlag[];
}): boolean {
  const broker = BigInt(input.brokerReportedAvailableMinor);
  const executable = BigInt(input.executableBuyingPowerMinor);
  if (input.posture.includes('NO_MARGIN') && broker > executable) {
    return true;
  }
  return broker !== executable;
}
