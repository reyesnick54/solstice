import { connectSunRey, startPublicGateway } from '../src/index.ts';

const gateway = await startPublicGateway();
const client = connectSunRey(gateway.url);
const status = await client.status();
console.log(JSON.stringify({ network: status.network_id, height: status.finalized_height, finalized: true }));
await gateway.close();
