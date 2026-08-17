/**
 * One-command developer environment: network, RPC, events, faucet,
 * optional Exchange development service. Prints SDK connection info.
 */

import { startPublicGateway } from './gateway/server.ts';
import { PUBLIC_API_VERSION } from './versioning.ts';

const host = process.env.SUNREY_DEV_HOST ?? '127.0.0.1';
const port = Number(process.env.SUNREY_DEV_PORT ?? '18480');
const gateway = await startPublicGateway({ host, port, autoFinalize: true });

console.log('============================================================');
console.log('SunRey developer environment');
console.log('ENVIRONMENT=simulation');
console.log(`api_version=${PUBLIC_API_VERSION}`);
console.log(`rpc=${gateway.url}/v1`);
console.log(`events=${gateway.eventsUrl}`);
console.log(`faucet=${gateway.url}/v1/dev/faucet`);
console.log(`exchange=${gateway.url}/v1/exchange`);
console.log(`operator=${gateway.operatorUrl}  (not on the public namespace)`);
console.log(`network_id=${gateway.networkId}`);
console.log('sdk: connectSunRey(rpcUrl)');
console.log('============================================================');

await new Promise<void>((resolve) => {
  const shutdown = () => {
    void gateway.close().then(() => resolve());
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
});
