/**
 * Consumer platform application facade.
 * Composes identity, accounts, Kernel, evidence, and events.
 * Not a second ledger, Kernel, or public SDK.
 */

export {
  CONSUMER_PLATFORM_ROUTES,
  createConsumerPlatformRuntime,
  startConsumerPlatform,
} from './runtime.ts';
export type { ConsumerPlatformOptions, RunningConsumerPlatform } from './runtime.ts';
export { PERSONA_DEFINITIONS, personaById, sandboxPersonasAllowed } from './personas.ts';
export { ConsumerWorkflowStore, assertSimulationWebhookUrl } from './workflows.ts';
