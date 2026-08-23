/**
 * Phase F inference posture. These are compiled constants, not env toggles.
 * An environment variable cannot approve a model for production.
 */
export const AI_CORE_CODE_COMPLETE_CANDIDATE = true as const;
export const AI_PRODUCTION_READY = false as const;
export const AI_PRODUCTION_ACTIVE = false as const;
export const AI_LIVE_CONNECTIVITY_ENABLED = false as const;
export const AI_PRODUCTION_AUTHORIZED = false as const;
export const AI_ENVIRONMENT = 'simulation' as const;
