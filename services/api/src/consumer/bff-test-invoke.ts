import { handleConsumerBff, type BffRequest, type BffResponse, type ConsumerBffRuntime } from './handler.ts';

export async function invokeConsumerBff(
  runtime: ConsumerBffRuntime,
  request: BffRequest,
): Promise<BffResponse> {
  return await handleConsumerBff(runtime, request);
}
