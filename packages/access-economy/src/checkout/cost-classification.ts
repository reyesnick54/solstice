/**
 * ACCESS Wave 3 Prompt 34 — Provider quote cost classification.
 */

import { classifyCostLine } from './coverage-policy.ts';
import type { AccessCheckoutCoveragePolicy } from './coverage-policy.ts';
import type {
  AccessProviderFirmQuote,
  ClassifiedCostComponent,
  ProviderQuoteCostLine,
} from './types.ts';

export function buildCostLinesFromFirmQuote(quote: AccessProviderFirmQuote): readonly ProviderQuoteCostLine[] {
  if (quote.costLines.length > 0) {
    return quote.costLines;
  }
  const lines: ProviderQuoteCostLine[] = [];
  if (quote.baseAmount > 0n) {
    lines.push({
      lineId: 'base',
      code: 'BASE_SERVICE',
      label: 'Base service cost',
      amountMinorUnits: quote.baseAmount,
      costType: 'BASE',
      optional: false,
    });
  }
  if (quote.taxes > 0n) {
    lines.push({
      lineId: 'taxes',
      code: 'TAX',
      label: 'Taxes',
      amountMinorUnits: quote.taxes,
      costType: 'TAX',
      optional: false,
    });
  }
  if (quote.mandatoryFees > 0n) {
    lines.push({
      lineId: 'mandatory_fees',
      code: 'MANDATORY_FEE',
      label: 'Mandatory fees',
      amountMinorUnits: quote.mandatoryFees,
      costType: 'MANDATORY_FEE',
      optional: false,
    });
  }
  if (quote.optionalFees > 0n) {
    lines.push({
      lineId: 'optional_fees',
      code: 'OPTIONAL_FEE',
      label: 'Optional fees',
      amountMinorUnits: quote.optionalFees,
      costType: 'OPTIONAL_FEE',
      optional: true,
    });
  }
  if (quote.securityDeposit > 0n) {
    lines.push({
      lineId: 'security_deposit',
      code: 'SECURITY_DEPOSIT',
      label: 'Security deposit',
      amountMinorUnits: quote.securityDeposit,
      costType: 'SECURITY_DEPOSIT',
      optional: false,
    });
  }
  if (quote.contingentLiability > 0n) {
    lines.push({
      lineId: 'contingent_liability',
      code: 'CONTINGENT_LIABILITY',
      label: 'Contingent liability',
      amountMinorUnits: quote.contingentLiability,
      costType: 'CONTINGENT_LIABILITY',
      optional: false,
    });
  }
  return Object.freeze(lines);
}

export function classifyProviderQuoteCosts(
  quote: AccessProviderFirmQuote,
  policy: AccessCheckoutCoveragePolicy,
): readonly ClassifiedCostComponent[] {
  const lines = buildCostLinesFromFirmQuote(quote);
  return Object.freeze(
    lines.map((line) => {
      const classification = classifyCostLine(line, policy);
      return Object.freeze({
        lineId: line.lineId,
        code: line.code,
        label: line.label,
        amountMinorUnits: line.amountMinorUnits,
        sourceCostType: line.costType,
        classification,
        accessEligible: classification === 'ACCESS_ELIGIBLE',
      });
    }),
  );
}

export function sumEligibleCost(components: readonly ClassifiedCostComponent[]): bigint {
  return components.reduce(
    (total, row) => (row.accessEligible ? total + row.amountMinorUnits : total),
    0n,
  );
}

export function sumExcludedCost(components: readonly ClassifiedCostComponent[]): bigint {
  return components.reduce(
    (total, row) => (!row.accessEligible ? total + row.amountMinorUnits : total),
    0n,
  );
}
