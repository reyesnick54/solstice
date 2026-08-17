import { connectSunRey, startPublicGateway } from '../src/index.ts';

const gateway = await startPublicGateway();
const client = connectSunRey(gateway.url);
const markets = await client.exchange.listMarkets();
const book = await client.exchange.getOrderBook('market:sunrey-coin-usd-simulation');
console.log(JSON.stringify({ markets, book }));
await gateway.close();
