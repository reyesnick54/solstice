import { SunReyClient } from './clients.ts';
import { createHttpTransport } from './http.ts';
import { connectSunReyPool, pooledTransport } from './pool.ts';

export function connectSunRey(rpcUrl: string): SunReyClient {
  return new SunReyClient(createHttpTransport(rpcUrl));
}

export function connectSunReyWithFailover(rpcUrls: readonly string[]): SunReyClient {
  return new SunReyClient(pooledTransport(rpcUrls));
}

export { connectSunReyPool };
