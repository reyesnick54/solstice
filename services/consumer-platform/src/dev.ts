import { startConsumerPlatform } from './runtime.ts';

const host = process.env.SUNREY_CONSUMER_HOST ?? '127.0.0.1';
const port = Number(process.env.SUNREY_CONSUMER_PORT ?? '18580');

const platform = await startConsumerPlatform({
  host,
  port,
  allowSandboxPersonas: process.env.SUNREY_SANDBOX_PERSONAS === '1',
  integrationEnvironment: 'LOCAL',
});

console.log(`SunRey consumer platform ${platform.apiVersion} at ${platform.url}`);
console.log('ENVIRONMENT=simulation PRODUCTION_ACTIVE=false');
