import { startSunReyPreview } from './preview.ts';

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

const host = process.env.SUNREY_API_HOST ?? '0.0.0.0';
const port = parsePort(process.env.SUNREY_API_PORT ?? process.env.PORT, 8443);
const allowedOrigins = parseOrigins(process.env.SUNREY_API_ALLOWED_ORIGINS);
const allowSandboxPersonas = process.env.SUNREY_PREVIEW_SANDBOX_PERSONAS === 'true';
const allowPreviewAuth = process.env.SUNREY_PREVIEW_AUTH_ENABLED === 'true';
const allowLocalOrigins = process.env.SUNREY_PREVIEW_ALLOW_LOCAL_ORIGINS !== 'false';
const previewAuthEmail = process.env.SUNREY_PREVIEW_AUTH_EMAIL;
const previewAuthPassword = process.env.SUNREY_PREVIEW_AUTH_PASSWORD;

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
  }),
);

const shutdown = async (signal: string): Promise<void> => {
  console.log(JSON.stringify({ level: 'info', service: 'sunrey-consumer-bff', message: 'graceful shutdown', signal }));
  await api.close();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
