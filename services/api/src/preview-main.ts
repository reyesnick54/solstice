import { startSunReyPreview } from './preview.ts';
import {
  createProductIntegrationRuntime,
  type ProductIntegrationRuntime,
} from './product-integration/index.ts';

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

let productIntegration: ProductIntegrationRuntime | null = null;
if (productIntegrationMode === 'DURABLE') {
  productIntegration = await createProductIntegrationRuntime({ forceMode: 'DURABLE' });
  if (productIntegration.mode !== 'DURABLE' || !productIntegration.durableAccounts) {
    throw new Error('durable product integration was requested but PostgreSQL durable runtime was not created');
  }
}

const api = await startSunReyPreview({
  host,
  port,
  allowedOrigins,
  allowSandboxPersonas,
  allowPreviewAuth,
  allowLocalOrigins,
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
    sandboxPersonasExposed: allowSandboxPersonas,
    previewAuthEnabled: allowPreviewAuth,
    productIntegrationMode,
    durableProductRuntimeAttached: productIntegration?.mode === 'DURABLE',
    consumerStateAuthority: 'SANDBOX_FIXTURE_PENDING_DURABLE_BINDING',
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
