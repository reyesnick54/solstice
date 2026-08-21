import { createPlatformApi } from './app.ts';
import { ConfigValidationError } from './config.ts';

const api = await createPlatformApi().catch((error: unknown) => {
  if (error instanceof ConfigValidationError) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'sunrey-platform-api',
        message: 'startup configuration failed closed',
        fields: error.fieldErrors,
      }),
    );
    process.exit(1);
  }
  throw error;
});

console.log(
  JSON.stringify({
    level: 'info',
    service: 'sunrey-platform-api',
    message: 'listening',
    url: api.url,
    environment: api.config.environment,
    PRODUCTION_READY: false,
    PRODUCTION_ACTIVE: false,
  }),
);

const shutdown = async (signal: string): Promise<void> => {
  console.log(
    JSON.stringify({
      level: 'info',
      service: 'sunrey-platform-api',
      message: 'graceful shutdown',
      signal,
    }),
  );
  await api.close();
  process.exit(0);
};

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
