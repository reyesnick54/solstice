/**
 * Wave 6 — Human Economic Value Engine (PEVE) boundary constitution.
 *
 * PEVE evaluates a defined contribution under a defined methodology.
 * It is not intrinsic human worth, not SunRey quantity, and not market price.
 *
 * Distinct from `packages/platform/src/value/` Personal Economic Value Engine
 * which measures person-level economic system performance.
 */

export const WAVE6_PEVE_CONSTITUTION_ID = 'sunrey-wave6-human-economic-value-engine' as const;
export const WAVE6_PEVE_CONSTITUTION_VERSION = '1' as const;
export const WAVE6_PEVE_SCHEMA_VERSION = 1 as const;

export const PEVE_IS_NOT_HUMAN_WORTH = true as const;
export const PEVE_IS_NOT_SUNREY_QUANTITY = true as const;
export const PEVE_IS_NOT_MARKET_PRICE = true as const;
export const PEVE_IS_NOT_PLATFORM_PEVE = false as const; // naming collision guard — see taxonomy note

export const HUMAN_WORTH_ASSIGNED = false as const;
export const HUMAN_WORTH_SCORE = false as const;
export const PEVE_SCORE_USED_AS_VALUE = false as const;
export const PEVE_USED_AS_TOKEN_FORMULA = false as const;
export const PEVE_SETS_EXCHANGE_PRICE = false as const;
export const PEVE_MINTS_SUNREY = false as const;
export const PEVE_CHANGES_TOTAL_SUPPLY = false as const;
export const PEVE_APPROVES_GOVERNANCE = false as const;
export const PEVE_OVERRIDES_CONSENT = false as const;
export const PEVE_OVERRIDES_IDENTITY_VERIFICATION = false as const;
export const PRODUCTION_PEVE_ACTIVATED = false as const;

export const WAVE6_PEVE_BOUNDARY = Object.freeze({
  constitutionId: WAVE6_PEVE_CONSTITUTION_ID,
  constitutionVersion: WAVE6_PEVE_CONSTITUTION_VERSION,
  schemaVersion: WAVE6_PEVE_SCHEMA_VERSION,
  humanWorthAssigned: HUMAN_WORTH_ASSIGNED,
  humanWorthScore: HUMAN_WORTH_SCORE,
  peveScoreUsedAsValue: PEVE_SCORE_USED_AS_VALUE,
  peveUsedAsTokenFormula: PEVE_USED_AS_TOKEN_FORMULA,
  setsExchangePrice: PEVE_SETS_EXCHANGE_PRICE,
  mintsSunRey: PEVE_MINTS_SUNREY,
  changesTotalSupply: PEVE_CHANGES_TOTAL_SUPPLY,
  approvesGovernance: PEVE_APPROVES_GOVERNANCE,
  overridesConsent: PEVE_OVERRIDES_CONSENT,
  overridesIdentityVerification: PEVE_OVERRIDES_IDENTITY_VERIFICATION,
  productionActivated: PRODUCTION_PEVE_ACTIVATED,
  isPersonValue: false,
  isHumanWorthScore: false,
  isSunReyQuantity: false,
  isMarketPrice: false,
});

export const PEVE_NOT_HUMAN_WORTH =
  'Human Economic Valuation assigns a versioned reference value to one verified contribution event. It is not a person-value score or human-worth ranking.';

export const PEVE_NOT_SUNREY_QUANTITY =
  'A PEVE valuation result is not a SunRey Coin quantity and does not create mint authority or change total supply.';

export const PEVE_NOT_MARKET_PRICE =
  'PEVE does not read SunRey Exchange price, market capitalization, or live market quotes. Exchange price does not determine PEVE.';

export const PEVE_NOT_PLATFORM_COMPOSITE =
  'Platform PEVE (Personal Economic Value Engine) measures person-level economic system performance. Human Economic Valuation (Wave 6 PEVE) values one verified contribution event. These are distinct systems.';
