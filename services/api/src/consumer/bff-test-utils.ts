import {
  handleConsumerBff,
  type BffRequest,
  type BffResponse,
  type ConsumerBffRuntime,
} from './handler.ts';

export type { BffRequest, BffResponse, ConsumerBffRuntime } from './handler.ts';
export { handleConsumerBff } from './handler.ts';

/** Narrow sync BFF responses in unit tests (most routes are synchronous). */
export function unwrapBff(response: BffResponse | Promise<BffResponse>): BffResponse {
  if (response instanceof Promise) {
    throw new Error('Async BFF route — use invokeBff instead');
  }
  return response;
}

/** Synchronous BFF handler for unit tests on sync routes. */
export function handleConsumerBffSync(
  runtime: ConsumerBffRuntime,
  request: BffRequest,
): BffResponse {
  return unwrapBff(handleConsumerBff(runtime, request));
}

export async function invokeBff(
  runtime: ConsumerBffRuntime,
  request: BffRequest,
): Promise<BffResponse> {
  return await handleConsumerBff(runtime, request);
}
