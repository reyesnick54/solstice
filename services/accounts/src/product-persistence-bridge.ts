/**
 * Persistence helpers for product integration durable mode.
 * services/api must not import packages/persistence directly; this bridge is the allowed path.
 */

export {
  isPersistenceTestEnabled,
  persistenceEnvFromProcess,
} from '../../../packages/persistence/src/env.ts';
export {
  loadAgentRuntimeState,
  persistAgentRuntimeState,
} from '../../../packages/persistence/src/agent/pg-agent-runtime-store.ts';
export { persistConsentState } from '../../../packages/persistence/src/consent/pg-consent-store.ts';
