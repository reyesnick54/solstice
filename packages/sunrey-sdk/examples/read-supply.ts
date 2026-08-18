import { connectSunRey, startPublicGateway } from '../src/index.ts';

const gateway = await startPublicGateway();
const client = connectSunRey(gateway.url);
const supply = await client.assets.supply();
const monetary = await client.monetary.supply();
console.log(JSON.stringify({ supply, monetary }));
await gateway.close();
