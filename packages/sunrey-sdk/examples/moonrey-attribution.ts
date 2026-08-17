import { connectSunRey, startPublicGateway } from '../src/index.ts';

const gateway = await startPublicGateway();
const client = connectSunRey(gateway.url);
const attribution = await client.productive.moonreyAttribution();
console.log(JSON.stringify(attribution));
await gateway.close();
