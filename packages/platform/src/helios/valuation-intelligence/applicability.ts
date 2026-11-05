/**
 * Valuation method applicability — not every issuer requires every method.
 */

import type { ValuationMethod } from './taxonomy.ts';

export type ValuationIssuerProfile = {
  readonly canonicalEntityId: string;
  readonly sector: string | null;
  readonly reportingSegments: number;
  readonly paysRegularDividend: boolean;
  readonly hasPositiveOperatingCashFlow: boolean;
  readonly hasMeaningfulBookEquity: boolean;
  readonly hasMarketPrice: boolean;
  readonly hasPeerUniverse: boolean;
  readonly isPreRevenue: boolean;
  readonly hasLeverageInputs: boolean;
};

export type ValuationMethodApplicability = {
  readonly method: ValuationMethod;
  readonly applicable: boolean;
  readonly reasons: readonly string[];
};

const METHOD_RULES: Record<
  ValuationMethod,
  (profile: ValuationIssuerProfile) => { applicable: boolean; reasons: readonly string[] }
> = {
  DCF_FCFF: (profile) => {
    if (profile.isPreRevenue) {
      return Object.freeze({ applicable: false, reasons: Object.freeze(['pre_revenue']) });
    }
    if (!profile.hasPositiveOperatingCashFlow) {
      return Object.freeze({ applicable: false, reasons: Object.freeze(['missing_operating_cash_flow']) });
    }
    return Object.freeze({ applicable: true, reasons: Object.freeze(['fcf_foundation_available']) });
  },
  DCF_FCFE: (profile) => {
    if (profile.isPreRevenue) {
      return Object.freeze({ applicable: false, reasons: Object.freeze(['pre_revenue']) });
    }
    if (!profile.hasLeverageInputs) {
      return Object.freeze({ applicable: false, reasons: Object.freeze(['missing_leverage_inputs']) });
    }
    if (!profile.hasPositiveOperatingCashFlow) {
      return Object.freeze({ applicable: false, reasons: Object.freeze(['missing_cash_flow_anchor']) });
    }
    return Object.freeze({ applicable: true, reasons: Object.freeze(['fcfe_inputs_available']) });
  },
  DIVIDEND_DISCOUNT: (profile) => {
    if (!profile.paysRegularDividend) {
      return Object.freeze({ applicable: false, reasons: Object.freeze(['not_dividend_payer']) });
    }
    return Object.freeze({ applicable: true, reasons: Object.freeze(['dividend_history']) });
  },
  RESIDUAL_INCOME: (profile) => {
    if (!profile.hasMeaningfulBookEquity) {
      return Object.freeze({ applicable: false, reasons: Object.freeze(['missing_book_equity']) });
    }
    return Object.freeze({ applicable: true, reasons: Object.freeze(['book_equity_available']) });
  },
  REVERSE_DCF: (profile) => {
    if (!profile.hasMarketPrice) {
      return Object.freeze({ applicable: false, reasons: Object.freeze(['missing_market_price']) });
    }
    if (profile.isPreRevenue) {
      return Object.freeze({ applicable: false, reasons: Object.freeze(['pre_revenue']) });
    }
    return Object.freeze({ applicable: true, reasons: Object.freeze(['market_price_and_fcf_anchor']) });
  },
  COMPARABLE_MULTIPLES: (profile) => {
    if (!profile.hasPeerUniverse) {
      return Object.freeze({ applicable: false, reasons: Object.freeze(['missing_peer_universe']) });
    }
    return Object.freeze({ applicable: true, reasons: Object.freeze(['peer_set_available']) });
  },
  SUM_OF_PARTS: (profile) => {
    if (profile.reportingSegments < 2) {
      return Object.freeze({ applicable: false, reasons: Object.freeze(['single_segment_reporting']) });
    }
    return Object.freeze({ applicable: true, reasons: Object.freeze(['multi_segment_reporting']) });
  },
};

export function evaluateValuationMethodApplicability(
  profile: ValuationIssuerProfile,
  method: ValuationMethod,
): ValuationMethodApplicability {
  const verdict = METHOD_RULES[method](profile);
  return Object.freeze({
    method,
    applicable: verdict.applicable,
    reasons: Object.freeze([...verdict.reasons]),
  });
}

export function listApplicableValuationMethods(
  profile: ValuationIssuerProfile,
  methods: readonly ValuationMethod[],
): readonly ValuationMethodApplicability[] {
  return Object.freeze(methods.map((method) => evaluateValuationMethodApplicability(profile, method)));
}

export function applicableMethodsOnly(
  profile: ValuationIssuerProfile,
  methods: readonly ValuationMethod[],
): readonly ValuationMethod[] {
  return Object.freeze(
    listApplicableValuationMethods(profile, methods)
      .filter((row) => row.applicable)
      .map((row) => row.method),
  );
}
