/**
 * Legally distinct account classes. These must never be blended into an
 * undifferentiated figure without the per-class breakdown remaining adjacent.
 */
export const ACCOUNT_CLASSES = [
  "deposits",
  "investments",
  "digital_assets",
  "rewards",
  "pending",
] as const;

export type AccountClass = (typeof ACCOUNT_CLASSES)[number];

export type InsuranceClassification = "insured" | "at_risk";
export type RealizationClassification = "realized" | "unrealized" | "pending";

export type ClassificationTag<C extends AccountClass = AccountClass> = {
  readonly accountClass: C;
  readonly insurance: InsuranceClassification;
  readonly realization: RealizationClassification;
};

/**
 * Canonical classification per class:
 * - deposits are insured (e.g. deposit-insurance eligible) and realized
 * - investments / digital assets / rewards are at-risk
 * - pending earnings are at-risk and not yet realized
 */
export const CLASSIFICATION_BY_CLASS = {
  deposits: {
    accountClass: "deposits",
    insurance: "insured",
    realization: "realized",
  },
  investments: {
    accountClass: "investments",
    insurance: "at_risk",
    realization: "realized",
  },
  digital_assets: {
    accountClass: "digital_assets",
    insurance: "at_risk",
    realization: "realized",
  },
  rewards: {
    accountClass: "rewards",
    insurance: "at_risk",
    realization: "realized",
  },
  pending: {
    accountClass: "pending",
    insurance: "at_risk",
    realization: "pending",
  },
} as const satisfies { [C in AccountClass]: ClassificationTag<C> };

export function classificationFor<C extends AccountClass>(
  accountClass: C,
): ClassificationTag<C> {
  return CLASSIFICATION_BY_CLASS[accountClass] as ClassificationTag<C>;
}
