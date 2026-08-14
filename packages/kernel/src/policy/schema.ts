export const LEGAL_REVIEW_STATES = [
  'CONFIRMED_BY_COUNSEL',
  'DRAFT',
  'RESEARCH_REQUIRED',
] as const;

export type LegalReviewState = (typeof LEGAL_REVIEW_STATES)[number];

export type RuleEffect =
  | {
      readonly type: 'FORBID';
      readonly when: RuleWhen;
    }
  | {
      readonly type: 'REQUIRE_CHECK';
      readonly check: 'SANCTIONS' | 'AML';
      readonly when: RuleWhen;
    }
  | {
      readonly type: 'CAP_AMOUNT';
      readonly minorUnits: string;
      readonly currency: string;
      readonly when: RuleWhen;
    }
  | {
      readonly type: 'SIMULATION_EXCEPTION';
      readonly product: ProductName;
      readonly when: RuleWhen;
    };

export type ProductName =
  | 'DOMESTIC_PAYMENT'
  | 'CROSS_BORDER_PAYMENT'
  | 'FX_CONVERSION'
  | 'ADD_BENEFICIARY'
  | 'OPEN_ACCOUNT'
  | 'SEED_CREDIT'
  | 'CUSTOMER_LIFECYCLE'
  | 'COST_AVOIDED'
  | 'OPEN_PYR_WALLET'
  | 'PYR_SETTLEMENT'
  | 'PYR_TRANSFER'
  | 'CONSENT'
  | 'DATA_EXCHANGE'
  | 'CLEAN_ROOM'
  | 'PROOF_OF_CONTRIBUTION';

export type RuleWhen = {
  readonly action?: string;
  readonly product?: ProductName;
  readonly sourceCountry?: string;
  readonly destinationCountry?: string;
  readonly destinationCountryIn?: readonly string[];
  readonly currency?: string;
  readonly sameCountry?: boolean;
};

export type ProductRule = {
  readonly id: string;
  readonly title: string;
  readonly legalReviewState: LegalReviewState;
  readonly enabled: boolean;
  readonly effect: RuleEffect;
  readonly plainLanguageReason: string;
};

export type JurisdictionPack = {
  readonly version: string;
  readonly jurisdiction: string;
  readonly title: string;
  readonly rules: readonly ProductRule[];
};

export type PolicyQuestion = {
  readonly action: string;
  readonly product: ProductName;
  readonly sourceCountry: string;
  readonly destinationCountry: string;
  readonly currency: string;
  readonly amountMinorUnits?: bigint;
};

export function isLegalReviewState(value: unknown): value is LegalReviewState {
  return typeof value === 'string' && (LEGAL_REVIEW_STATES as readonly string[]).includes(value);
}
