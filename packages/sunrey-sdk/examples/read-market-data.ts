import { connectSunRey, startPublicGateway } from '../src/index.ts';

const gateway = await startPublicGateway();
const client = connectSunRey(gateway.url);
const markets = await client.exchange.listMarkets();
console.log(JSON.stringify({ markets }));
await gateway.close();
