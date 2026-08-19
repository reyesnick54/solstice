export const VALUATION_REVIEW_STATES = [
  'NOT_EVALUATED',
  'VALUATION_READY',
  'VALUATION_REVIEW_REQUIRED',
  'VALUATION_REJECTED',
  'VALUED_SIMULATION',
] as const;
export type ValuationReviewState = (typeof VALUATION_REVIEW_STATES)[number];

export const AI_VALUATION_BOUNDARY = Object.freeze({
  mayClassifyOrRetrieveReferencesLater: true,
  mayActivatePolicy: false,
  mayApproveProductionPolicy: false,
  mayOverrideProtectedTraitRules: false,
  mayAuthorizeSettlement: false,
  mayAuthorizeMinting: false,
  finalValuationAuthority: false,
});

export type ValuationReviewDecision = {
  readonly state: ValuationReviewState;
  readonly productionActivated: false;
  readonly sunReyQuantity: null;
  readonly issuesExecutionAuthority: false;
  readonly issuesMintAuthority: false;
  readonly aiFinalAuthority: false;
};

export function reviewDecision(state: ValuationReviewState): ValuationReviewDecision {
  return Object.freeze({
    state,
    productionActivated: false,
    sunReyQuantity: null,
    issuesExecutionAuthority: false,
    issuesMintAuthority: false,
    aiFinalAuthority: false,
  });
}
