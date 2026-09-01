import { asUtcInstant } from '../packages/domain/src/time.ts';
import { ExchangeBffSurface } from '../services/api/src/consumer/exchange.ts';
import { createSandboxWorld, sandboxToken } from '../services/api/src/consumer/fixtures.ts';
import { handleConsumerBff, type BffRequest, type BffResponse, type ConsumerBffRuntime } from '../services/api/src/consumer/handler.ts';
import { createAgentConversationSurface } from '../services/api/src/consumer/conversation.ts';
import { startConsumerBff } from '../services/api/src/consumer/http.ts';

export const PHASE_G_NOW = asUtcInstant('2026-08-23T12:00:00.000Z');
export const PHASE_G_TOKEN = sandboxToken('basic_verified');

export type PhaseGWorld = {
  readonly token: string;
  readonly exchange: ExchangeBffSurface;
  readonly handle: (
    request: Omit<BffRequest, 'authorization' | 'body' | 'query'> & {
      readonly authorization?: string;
      readonly body?: unknown;
      readonly query?: Readonly<Record<string, string>>;
    },
  ) => Promise<BffResponse>;
  readonly startHttp: () => ReturnType<typeof startConsumerBff>;
};

export function createPhaseGWorld(): PhaseGWorld {
  const sandbox = createSandboxWorld();
  const exchange = new ExchangeBffSurface(() => PHASE_G_NOW);
  const conversation = createAgentConversationSurface();
  const runtime: ConsumerBffRuntime = {
    bff: sandbox.bff,
    sessions: sandbox.sessions,
    identity: sandbox.runtime.identity.service,
    exchange,
    conversation,
  };
  return {
    token: PHASE_G_TOKEN,
    exchange,
    handle: async (request) =>
      await handleConsumerBff(runtime, {
        method: request.method,
        path: request.path,
        query: request.query ?? {},
        body: request.body ?? {},
        authorization: request.authorization ?? `Bearer ${PHASE_G_TOKEN}`,
      }),
    startHttp: () => startConsumerBff({ runtime }),
  };
}
