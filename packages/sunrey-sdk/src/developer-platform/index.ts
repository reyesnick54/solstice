/**
 * Chunk 94 — SunRey developer platform public interface.
 *
 * Adapter over the existing SDK, Testnet faucet, and public RPC gateway.
 * Developer credentials cannot sign user funds. Creating a production
 * application does not activate production financial capabilities.
 */

import { DeveloperPlatformEngine } from './portal.ts';
import { buildDeveloperPlatformReport, type DeveloperPlatformReport } from './report.ts';

export {
  APPLICATION_ENVIRONMENTS,
  APPLICATION_STATUSES,
  DEVELOPER_ROLES,
  DEVELOPER_SCOPES,
  PROTOCOL_GOVERNANCE_ROLES,
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_DELIVERY_STATES,
  WEBHOOK_SIGNING_SCHEME,
  DEFAULT_WEBHOOK_RETRY_POLICY,
  SCOPE_REQUIRED_EVENTS,
  isDeveloperRole,
  isProtocolGovernanceRole,
  isDeveloperScope,
} from './types.ts';
export type {
  DeveloperAccount,
  DeveloperOrganization,
  DeveloperApplication,
  ApplicationEnvironment,
  DeveloperApiCredential,
  DeveloperPermission,
  DeveloperQuota,
  WebhookEndpoint,
  WebhookSubscription,
  WebhookDelivery,
  WebhookRetryPolicy,
  DeveloperUsageRecord,
  SandboxAccount,
  DeveloperRole,
  TestnetStatusSnapshot,
  ApiDeprecation,
} from './types.ts';
export { verifyWebhookSignature, signWebhookDelivery, hashSecret } from './crypto.ts';
export { inspectWebhookDestination } from './ssrf.ts';
export { WebhookDispatcher } from './webhooks.ts';
export { QuotaLedger, createSimulationBillingPort } from './quotas.ts';
export type { DeveloperBillingPort } from './quotas.ts';
export { createSandboxAccount, sandboxCannotBecomeProduction } from './sandbox.ts';
export { DeveloperFaucet } from './faucet.ts';
export { DeveloperPlatformEngine } from './portal.ts';
export { startLocalDeveloperStack, createMockWebhookReceiver } from './local-devnet.ts';
export { runSunReyDev, createCliContext } from './cli.ts';
export { buildDeveloperPlatformReport } from './report.ts';
export type { DeveloperPlatformReport } from './report.ts';

export class DeveloperPortalApi extends DeveloperPlatformEngine {
  report(): DeveloperPlatformReport {
    return buildDeveloperPlatformReport(this);
  }
}
