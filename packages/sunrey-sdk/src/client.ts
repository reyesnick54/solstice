import { SunReyClient } from './clients.ts';
import { createHttpTransport } from './http.ts';

export function connectSunRey(rpcUrl: string): SunReyClient {
  return new SunReyClient(createHttpTransport(rpcUrl));
}
