/**
 * ACCESS-15 / ACCESS-18 permanent participation invariants.
 */

export const ACCESS_PARTICIPATION_INVARIANT_IDS = Object.freeze([
  'NO_RAW_DATA_IN_ACCESS_FORMULA',
  'NO_CONSENT_EQUALS_MINT',
  'NO_DATA_RECORD_EQUALS_MINT',
  'NO_CLEAN_ROOM_RESULT_EQUALS_MINT',
  'NO_HUMAN_WORTH_SCORE',
  'NO_PROTECTED_TRAIT_ACCESS_MULTIPLIER',
  'ONLY_ACTUAL_SETTLED_SR_AFFECTS_SR_TWAB',
  'NO_DUPLICATE_HUMAN_CONTRIBUTION_REWARD',
] as const);

export type AccessParticipationInvariantId = (typeof ACCESS_PARTICIPATION_INVARIANT_IDS)[number];

/** Fields that must never influence access participation weighting. */
export const FORBIDDEN_PARTICIPATION_INPUT_FIELDS = Object.freeze([
  'dataCategory',
  'dataCategories',
  'healthInformation',
  'healthData',
  'preferences',
  'identityTraits',
  'researchParticipationLabel',
  'researchParticipation',
  'protectedTrait',
  'protectedTraits',
  'humanWorthScore',
  'socialCreditScore',
  'dataBonus',
  'dataMultiplier',
  'consentScore',
  'cleanRoomScore',
  'aiValuation',
] as const);

export function collectForbiddenParticipationFields(value: unknown, path = ''): string[] {
  if (value == null || typeof value !== 'object') {
    return [];
  }
  const violations: string[] = [];
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const currentPath = path ? `${path}.${key}` : key;
    if ((FORBIDDEN_PARTICIPATION_INPUT_FIELDS as readonly string[]).includes(key)) {
      violations.push(currentPath);
    }
    violations.push(...collectForbiddenParticipationFields(nested, currentPath));
  }
  return violations;
}

export function assertParticipationInputBoundary(value: unknown): string | null {
  const violations = collectForbiddenParticipationFields(value);
  return violations.length > 0 ? violations[0] ?? 'forbidden field' : null;
}
