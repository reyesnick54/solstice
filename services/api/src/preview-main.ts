import { startSunReyPreview } from './preview.ts';
import {
  createProductIntegrationRuntime,
  type ProductIntegrationRuntime,
} from './product-integration/index.ts';
import { ensureDurableSandboxCoreState } from './consumer/durable-account-state.ts';
import { ensureDurableSandboxAccountCapability } from './consumer/durable-account-capability.ts';
import { ensureDurableSandboxTransferCapability } from './consumer/durable-transfer-capability.ts';
import { DurableInternalPaymentSurface } from './consumer/durable-internal-payments.ts';
import { DurableMoneyAccountMutations } from './consumer/durable-money-account-mutations.ts';
import { createDurableExchangeSurface, type DurableExchangeSurface } from './consumer/durable-exchange.ts';
import { DurableWalletSurface } from './consumer/durable-wallets.ts';
import { DurableCustomerAuth } from './consumer/durable-customer-auth.ts';
import { refreshSimulatedActors, type SimulatedActorFreshnessReport } from './consumer/simulated-actor-freshness.ts';
import { ENVIRONMENT } from '../../../packages/config/src/flags.ts';
import { systemClock } from '../../../packages/config/src/clock.ts';
import { deriveRuntimeKeySecrets } from './product-integration/runtime-key-seed.ts';

function parsePort(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error('SUNREY_API_PORT must be an integer between 1 and 65535');
  }
  return value;
}

function parseOrigins(raw: string | undefined): readonly string[] {
  if (!raw) return [];
  return Object.freeze(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}

function requestedRuntimeClock(raw: string | undefined): 'FROZEN' | 'SYSTEM' {
  const value = (raw ?? 'FROZEN').trim().toUpperCase();
  if (value === 'FROZEN' || value === 'SYSTEM') return value;
  throw new Error('SUNREY_RUNTIME_CLOCK must be FROZEN or SYSTEM');
}

function requestedProductIntegrationMode(raw: string | undefined): 'IN_MEMORY' | 'DURABLE' {
  const value = (raw ?? 'IN_MEMORY').trim().toUpperCase();
  if (value === 'DURABLE') return 'DURABLE';
  if (value === 'IN_MEMORY') return 'IN_MEMORY';
  throw new Error('SUNREY_PRODUCT_INTEGRATION_MODE must be IN_MEMORY or DURABLE');
}

const host = process.env.SUNREY_API_HOST ?? '0.0.0.0';
const port = parsePort(process.env.SUNREY_API_PORT ?? process.env.PORT, 8443);
const allowedOrigins = parseOrigins(process.env.SUNREY_API_ALLOWED_ORIGINS);
const allowSandboxPersonas = process.env.SUNREY_PREVIEW_SANDBOX_PERSONAS === 'true';
const allowPreviewAuth = process.env.SUNREY_PREVIEW_AUTH_ENABLED === 'true';
const allowLocalOrigins = process.env.SUNREY_PREVIEW_ALLOW_LOCAL_ORIGINS !== 'false';
const previewAuthEmail = process.env.SUNREY_PREVIEW_AUTH_EMAIL;
const previewAuthPassword = process.env.SUNREY_PREVIEW_AUTH_PASSWORD;
const productIntegrationMode = requestedProductIntegrationMode(process.env.SUNREY_PRODUCT_INTEGRATION_MODE);
// Self-registered customer login. Requires DURABLE mode (identities and
// customers live in PostgreSQL) and is off unless explicitly enabled.
const customerAuthRequested = process.env.SUNREY_CUSTOMER_AUTH_ENABLED === 'true';
// Real users need real time: session expiry and TOTP are evaluated against the
// runtime clock. FROZEN (default) keeps the historical deterministic sandbox.
const runtimeClock = requestedRuntimeClock(process.env.SUNREY_RUNTIME_CLOCK);
const runtimeKeySeed = process.env.SUNREY_RUNTIME_KEY_SEED;
if (customerAuthRequested && !runtimeKeySeed) {
  throw new Error('SUNREY_CUSTOMER_AUTH_ENABLED=true requires SUNREY_RUNTIME_KEY_SEED so stored credentials verify after restart');
}
const runtimeKeySecrets = runtimeKeySeed ? deriveRuntimeKeySecrets(runtimeKeySeed) : null;
if (customerAuthRequested && runtimeClock !== 'SYSTEM') {
  throw new Error('SUNREY_CUSTOMER_AUTH_ENABLED=true requires SUNREY_RUNTIME_CLOCK=SYSTEM so sessions expire and TOTP verifies');
}
if (customerAuthRequested && productIntegrationMode !== 'DURABLE') {
  throw new Error('SUNREY_CUSTOMER_AUTH_ENABLED=true requires SUNREY_PRODUCT_INTEGRATION_MODE=DURABLE');
}

let productIntegration: ProductIntegrationRuntime | null = null;
let durableSeedReport: Awaited<ReturnType<typeof ensureDurableSandboxCoreState>> | null = null;
let durableAccountCapabilityReport: Awaited<ReturnType<typeof ensureDurableSandboxAccountCapability>> | null = null;
let durableTransferCapabilityReport: Awaited<ReturnType<typeof ensureDurableSandboxTransferCapability>> | null = null;
let durableInternalPayments: DurableInternalPaymentSurface | null = null;
let durableMoneyAccountMutations: DurableMoneyAccountMutations | null = null;
let durableWallets: DurableWalletSurface | null = null;
let durableExchange: DurableExchangeSurface | null = null;
let customerAuth: DurableCustomerAuth | null = null;
let actorFreshness: SimulatedActorFreshnessReport | null = null;
if (productIntegrationMode === 'DURABLE') {
  productIntegration = await createProductIntegrationRuntime({
    forceMode: 'DURABLE',
    ...(runtimeClock === 'SYSTEM' ? { clock: systemClock } : {}),
    ...(runtimeKeySecrets ? { keySecrets: runtimeKeySecrets } : {}),
  });
  if (productIntegration.mode !== 'DURABLE' || !productIntegration.durableAccounts) {
    throw new Error('durable product integration was requested but PostgreSQL durable runtime was not created');
  }
  if (runtimeClock === 'SYSTEM') {
    // Simulated actors age in real time on a wall clock; renew before the
    // capability-ensure steps below, which require a usable STRONG session.
    const durable = productIntegration.durableAccounts;
    actorFreshness = refreshSimulatedActors(durable.runtime);
    await durable.persistAuthentication();
    const timer = setInterval(() => {
      const report = refreshSimulatedActors(durable.runtime);
      if (report.sessionsRenewed + report.grantsRenewed > 0) {
        durable.persistAuthentication().catch((error: unknown) => {
          console.error(JSON.stringify({ level: 'error', service: 'sunrey-consumer-bff', message: 'simulated actor refresh persist failed', error: String(error) }));
        });
      }
    }, 10 * 60 * 1000);
    timer.unref();
  }
  durableSeedReport = await ensureDurableSandboxCoreState(productIntegration.durableAccounts);
  durableAccountCapabilityReport = await ensureDurableSandboxAccountCapability(productIntegration.durableAccounts);
  durableTransferCapabilityReport = await ensureDurableSandboxTransferCapability(productIntegration.durableAccounts);
  durableInternalPayments = new DurableInternalPaymentSurface(productIntegration.durableAccounts);
  durableMoneyAccountMutations = new DurableMoneyAccountMutations(productIntegration.durableAccounts);
  durableWallets = await DurableWalletSurface.create(productIntegration.durableAccounts);
  durableExchange = await createDurableExchangeSurface(productIntegration.durableAccounts);
  if (customerAuthRequested) {
    customerAuth = new DurableCustomerAuth(productIntegration.durableAccounts, {
      environment: ENVIRONMENT,
    });
  }
}

const api = await startSunReyPreview({
  host,
  port,
  allowedOrigins,
  allowSandboxPersonas,
  allowPreviewAuth,
  allowLocalOrigins,
  ...(productIntegration ? { durableFinancialRuntime: productIntegration.accounts } : {}),
  ...(durableInternalPayments ? { durableInternalPayments } : {}),
  ...(durableMoneyAccountMutations ? { durableMoneyAccountMutations } : {}),
  ...(durableWallets ? { durableWallets } : {}),
  ...(durableExchange ? { durableExchange } : {}),
  ...(productIntegration ? { durableVault: productIntegration.vaultProduct } : {}),
  ...(customerAuth ? { customerAuth } : {}),
  ...(previewAuthEmail ? { previewAuthEmail } : {}),
  ...(previewAuthPassword ? { previewAuthPassword } : {}),
});

console.log(
  JSON.stringify({
    level: 'info',
    service: 'sunrey-consumer-bff',
    message: 'preview listening',
    url: api.url,
    environment: 'simulation',
    PRODUCTION_READY: false,
    PRODUCTION_ACTIVE: false,
    LIVE_CONNECTIVITY_ENABLED: false,
    MAINNET_ACTIVE: false,
    sandboxPersonasExposed: allowSandboxPersonas,
    previewAuthEnabled: allowPreviewAuth,
    customerAuthEnabled: customerAuth !== null,
    runtimeClock,
    runtimeKeysSeeded: runtimeKeySecrets !== null,
    ...(actorFreshness ? { simulatedActorFreshness: actorFreshness } : {}),
    productIntegrationMode,
    durableProductRuntimeAttached: productIntegration?.mode === 'DURABLE',
    durableFinancialReadModelBound: Boolean(productIntegration),
    durableAccountOpeningBound: Boolean(durableMoneyAccountMutations),
    durableSandboxFundingBound: Boolean(durableMoneyAccountMutations),
    durableInternalTransfersBound: Boolean(durableInternalPayments),
    durableWalletsBound: Boolean(durableWallets),
    durableExchangeBound: Boolean(durableExchange),
    durableVaultBound: Boolean(productIntegration),
    consumerStateAuthority: productIntegration
      ? 'HYBRID_POSTGRES_ACCOUNT_LEDGER_ACCOUNT_OPEN_SANDBOX_FUNDING_INTERNAL_TRANSFERS_NATIVE_WALLETS_EXCHANGE_VAULT_DURABLE_FIXTURE_OTHER_DOMAINS'
      : 'SANDBOX_FIXTURE_NON_PRODUCTION',
    ...(durableSeedReport ? { durableSeedReport } : {}),
    ...(durableAccountCapabilityReport ? { durableAccountCapabilityReport } : {}),
    ...(durableTransferCapabilityReport ? { durableTransferCapabilityReport } : {}),
    ...(durableWallets ? { durableWalletBinding: durableWallets.bindingReport } : {}),
    ...(durableExchange ? { durableExchangeBinding: durableExchange.bindingReport } : {}),
  }),
);

const shutdown = async (signal: string): Promise<void> => {
  console.log(JSON.stringify({ level: 'info', service: 'sunrey-consumer-bff', message: 'graceful shutdown', signal }));
  await api.close();
  if (productIntegration) {
    await productIntegration.persist();
    await productIntegration.close();
  }
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
