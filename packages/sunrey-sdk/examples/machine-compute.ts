import { connectSunRey, startPublicGateway } from '../src/index.ts';

const gateway = await startPublicGateway();
const client = connectSunRey(gateway.url);
console.log(JSON.stringify(await client.machines.offers()));
await gateway.close();
