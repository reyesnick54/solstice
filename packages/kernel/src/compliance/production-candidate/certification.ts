export const SANCTIONS_CERTIFICATION_CASES = [
  'no_match',
  'possible_match',
  'confirmed_review',
  'provider_unavailable',
] as const;

export const AML_CERTIFICATION_CASES = [
  'submit_signal',
  'alert',
  'case_creation',
  'duplicate_event',
] as const;

export const TRAVEL_RULE_CERTIFICATION_CASES = [
  'applicable',
  'not_applicable',
  'pending',
  'complete',
  'failed',
] as const;
