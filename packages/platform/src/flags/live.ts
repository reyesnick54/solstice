/**
 * Capability flags. These are the only switches that may enable real-world
 * side effects. They are not product experiment toggles.
 *
 * All LIVE_* flags are false and stay false. No code path may flip them.
 * Proposal generation may be deterministic or stubbed; enforcement is never
 * model-dependent and never calls an external LLM API.
 */
export const LIVE_MONEY_MOVEMENT = false as const;
export const LIVE_EXTERNAL_EXECUTION = false as const;
export const LIVE_SUBSCRIPTION_MUTATION = false as const;
export const LIVE_LLM_ENFORCEMENT = false as const;
export const LIVE_MERCHANT_NETWORK = false as const;
export const REAL_MONEY_ENABLED = false as const;

export const LIVE_FLAGS = Object.freeze({
  LIVE_MONEY_MOVEMENT,
  LIVE_EXTERNAL_EXECUTION,
  LIVE_SUBSCRIPTION_MUTATION,
  LIVE_LLM_ENFORCEMENT,
  LIVE_MERCHANT_NETWORK,
  REAL_MONEY_ENABLED,
});

export function assertSimulationOnly(): void {
  if (LIVE_MONEY_MOVEMENT !== false) {
    throw new Error('LIVE_MONEY_MOVEMENT must remain false');
  }
  if (LIVE_EXTERNAL_EXECUTION !== false) {
    throw new Error('LIVE_EXTERNAL_EXECUTION must remain false');
  }
  if (LIVE_SUBSCRIPTION_MUTATION !== false) {
    throw new Error('LIVE_SUBSCRIPTION_MUTATION must remain false');
  }
  if (LIVE_LLM_ENFORCEMENT !== false) {
    throw new Error('LIVE_LLM_ENFORCEMENT must remain false');
  }
  if (LIVE_MERCHANT_NETWORK !== false) {
    throw new Error('LIVE_MERCHANT_NETWORK must remain false');
  }
  if (REAL_MONEY_ENABLED !== false) {
    throw new Error('REAL_MONEY_ENABLED must remain false');
  }
}
