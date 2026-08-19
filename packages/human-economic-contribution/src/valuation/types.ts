/**
 * Chunk 111 / 112 — engineering-implemented human contribution
 * reference valuation. This is not PEVE, not a human-worth score,
 * and not a SunRey quantity. Production remains unactivated.
 */

export const HUMAN_CONTRIBUTION_VALUATION_SCHEMA_VERSION = 1 as const;
export const HUMAN_CONTRIBUTION_VALUATION_ID = 'sunrey.human-contribution.valuation.v1' as const;
export const ENGINEERING_SIMULATION_PARAMETERS = 'ENGINEERING_SIMULATION_PARAMETERS' as const;
export const PRODUCTION_VALUATION_POLICY_STATUS = 'UNCONFIGURED' as const;
export const PRODUCTION_VALUATION_ACTIVATION = 'NOT_ACTIVATED' as const;
export const REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION = false as const;

export const VALUATION_ENVIRONMENTS = ['DEVELOPMENT', 'SIMULATION', 'PRODUCTION'] as const;
export type ValuationEnvironment = (typeof VALUATION_ENVIRONMENTS)[number];

export const VALUATION_RESULT_STATES = ['ACTIVE', 'SUPERSEDED', 'INVALID'] as const;
export type ValuationResultState = (typeof VALUATION_RESULT_STATES)[number];

export const VALUATION_METHODS = ['ENGINEERING_SIMULATION_MEASUREMENT_SCALE'] as const;
export type ValuationMethod = (typeof VALUATION_METHODS)[number];

export const VALUATION_ACTORS = [
  'HUMAN',
  'PROTOCOL',
  'DEVELOPMENT_FIXTURE',
  'GOVERNED_PROTOCOL_SIMULATION',
] as const;
export type ValuationActor = (typeof VALUATION_ACTORS)[number];

export const FORBIDDEN_VALUATION_ACTORS = [
  'AI',
  'FINANCIAL_AGENT',
  'AGENT',
  'S3M',
  'GROK',
  'MODEL',
  'MODEL_OUTPUT',
] as const;
export type ForbiddenValuationActor = (typeof FORBIDDEN_VALUATION_ACTORS)[number];

export type HumanContributionValuationPolicy = {
  readonly policyId: string;
  readonly version: string;
  readonly environment: 'DEVELOPMENT' | 'SIMULATION';
  readonly referenceDenomination: string;
  readonly method: ValuationMethod;
  readonly unitScaleNumerator: bigint;
  readonly unitScaleDenominator: bigint;
  readonly perContributionReferenceCeiling: bigint;
  readonly jurisdictionPolicyRef: string;
  readonly governanceReference: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly simulationOnly: true;
  readonly productionActivated: false;
  readonly parameterClass: typeof ENGINEERING_SIMULATION_PARAMETERS;
  readonly peveUsedAsTokenFormula: false;
  readonly humanWorthUsedAsValue: false;
};

export const PRODUCTION_HUMAN_VALUATION_POLICY = Object.freeze({
  status: PRODUCTION_VALUATION_POLICY_STATUS,
  activation: PRODUCTION_VALUATION_ACTIVATION,
  productionActivated: false,
});

/**
 * Privacy-safe verified contribution input for reference valuation.
 * The valuation module does not import the registry implementation.
 */
export type VerifiedContributionValuationInput = {
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly status: 'VERIFIED';
  readonly verificationPolicyVersion: string;
  readonly measurementQuantity: bigint;
  readonly measurementUnit: string;
  readonly jurisdictionPolicyRef: string;
  readonly containsRawPersonalData: false;
  readonly peveScoreUsedAsValue: false;
  readonly humanWorthScore: false;
};

export type HumanContributionValuationResult = {
  readonly schemaVersion: typeof HUMAN_CONTRIBUTION_VALUATION_SCHEMA_VERSION;
  readonly valuationId: string;
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly valuationPolicyId: string;
  readonly valuationPolicyVersion: string;
  readonly valuationMethod: ValuationMethod;
  readonly valuationDigest: string;
  readonly finalReferenceValue: bigint;
  readonly referenceDenomination: string;
  readonly jurisdictionPolicyRef: string;
  readonly status: ValuationResultState;
  readonly environment: 'DEVELOPMENT' | 'SIMULATION';
  readonly simulationOnly: true;
  readonly productionActivated: false;
  readonly parameterClass: typeof ENGINEERING_SIMULATION_PARAMETERS;
  readonly peveUsedAsTokenFormula: false;
  readonly humanWorthUsedAsValue: false;
  readonly aiAuthorized: false;
  readonly referenceValueEqualsSunReyByDefinition: false;
  readonly sunReyQuantity: null;
};

export type ValuationFailureCode =
  | 'CONTRIBUTION_NOT_VERIFIED'
  | 'VALUATION_ACTOR_FORBIDDEN'
  | 'AI_CANNOT_AUTHORIZE_VALUATION'
  | 'FINANCIAL_AGENT_CANNOT_AUTHORIZE_VALUATION'
  | 'S3M_CANNOT_AUTHORIZE_VALUATION'
  | 'GROK_CANNOT_AUTHORIZE_VALUATION'
  | 'MODEL_OUTPUT_CANNOT_AUTHORIZE_VALUATION'
  | 'PEVE_CANNOT_BECOME_REFERENCE_VALUE'
  | 'HUMAN_WORTH_SCORE_REJECTED'
  | 'RAW_PERSONAL_DATA_REJECTED'
  | 'PRODUCTION_VALUATION_UNAVAILABLE'
  | 'VALUATION_POLICY_INVALID'
  | 'VALUATION_CAP_EXCEEDED'
  | 'INVALID_MEASUREMENT'
  | 'JURISDICTION_POLICY_MISMATCH';

export type ValuationFailure = {
  readonly ok: false;
  readonly code: ValuationFailureCode;
};

export type ValuationSuccess = {
  readonly ok: true;
  readonly result: HumanContributionValuationResult;
};

export type ValuationComputeResult = ValuationSuccess | ValuationFailure;
