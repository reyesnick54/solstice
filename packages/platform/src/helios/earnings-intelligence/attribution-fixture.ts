import type { UtcInstant } from '@solstice/domain';
import type { CanonicalAttributionSourcePort } from '../outcome-attribution/types.ts';

export function emptyGrowAttributionSource(extractedAt: UtcInstant): CanonicalAttributionSourcePort {
  return Object.freeze({
    customerId: 'cust_earn12_fixture',
    investmentAccountId: 'inv_acct_earn12_fixture',
    reportingCurrency: 'USD',
    costBasisMethod: 'FIFO_SIMULATION_ACCOUNTING_METHOD',
    taxAdvice: false as const,
    positions: Object.freeze([]),
    realized: Object.freeze([]),
    fills: Object.freeze([]),
    settlements: Object.freeze([]),
    fees: Object.freeze([]),
    income: Object.freeze([]),
    principalDepositsMinorUnits: '0',
    netContributionsMinorUnits: '0',
    cashAvailableMinorUnits: '0',
    cashUnsettledMinorUnits: '0',
    portfolioValueMinorUnits: '0',
    investedValueMinorUnits: '0',
    reconciliation: Object.freeze({ result: 'OK', findings: Object.freeze([]) }),
    fx: null,
    extractedAt,
  });
}
