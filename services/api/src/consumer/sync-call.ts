import {
  handleConsumerBff,
  type BffRequest,
  type BffResponse,
  type ConsumerBffRuntime,
  CONSUMER_BFF_ROUTES,
} from './handler.ts';

export type { BffRequest, BffResponse, ConsumerBffRuntime };
export { CONSUMER_BFF_ROUTES };

/** Test and fixture helper: consumer routes are sync except subscription delegation. */
export function callConsumerBffSync(runtime: ConsumerBffRuntime, request: BffRequest): BffResponse {
  const result = handleConsumerBff(runtime, request);
  if (result instanceof Promise) {
    throw new Error(`async consumer BFF path is not supported here: ${request.method} ${request.path}`);
  }
  return result;
}
