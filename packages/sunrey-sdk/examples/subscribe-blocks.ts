import { connectSunRey, startPublicGateway } from '../src/index.ts';

const gateway = await startPublicGateway({ autoFinalize: true });
const client = connectSunRey(gateway.url);
const events = await client.events.replay({ subscribe: ['newFinalizedBlock'] });
console.log(JSON.stringify({ events: events.events.length }));
await gateway.close();
