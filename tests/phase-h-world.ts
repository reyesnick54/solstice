import { asUtcInstant } from '../packages/domain/src/time.ts';
import { handleConsumerBff, handleConsumerBffSync, type BffRequest, type BffResponse, type ConsumerBffRuntime } from '../services/api/src/consumer/bff-test-utils.ts';
import { startConsumerBff } from '../services/api/src/consumer/http.ts';
import type { ConsumerBff } from '../services/api/src/consumer/orchestrator.ts';
import type { BffPrincipal } from '../services/api/src/consumer/ports.ts';
import { PhaseHProductSurface } from '../services/api/src/consumer/phase-h/index.ts';
import type { SessionDirectory } from '../services/api/src/consumer/session.ts';
import { createNativeEconomySurface } from '../services/api/src/consumer/native-economy-adapter.ts';

export const PHASE_H_TOKEN = 'sandbox.hin_ready';
export const PHASE_H_BOB_TOKEN = 'sandbox.vault_ready';
export const PHASE_H_LICENSEE_TOKEN = 'sandbox.data_licensee';
export const PHASE_H_NOW = asUtcInstant('2026-08-23T12:00:00.000Z');

function principal(input: {
  readonly actorId: string;
  readonly customerId: string;
  readonly identityId: string;
  readonly sessionId: string;
  readonly persona: string;
}): BffPrincipal {
  return {
    actorId: input.actorId,
    customerId: input.customerId,
    identityId: input.identityId,
    sessionId: input.sessionId,
    jurisdiction: 'GB',
    verification: 'VERIFIED',
    customerStatus: 'ACTIVE',
    identityStatus: 'VERIFIED',
    capabilities: ['VIEW_ACCOUNT', 'VAULT_VIEW_OWN', 'CONSENT_VIEW_OWN'],
    risk: 'LOW',
    restricted: false,
    sandboxPersona: input.persona,
    deviceSummary: { deviceId: `dev_${input.persona}`, trustState: 'TRUSTED' },
  };
}

export type PhaseHWorld = {
  readonly surface: PhaseHProductSurface;
  readonly runtime: ConsumerBffRuntime;
  readonly alice: BffPrincipal;
  readonly bob: BffPrincipal;
  readonly licensee: BffPrincipal;
  readonly handle: (
    request: Omit<BffRequest, 'authorization' | 'body' | 'query'> & {
      readonly authorization?: string;
      readonly body?: unknown;
      readonly query?: Readonly<Record<string, string>>;
    },
  ) => Promise<BffResponse>;
  readonly startHttp: () => ReturnType<typeof startConsumerBff>;
};

export function createPhaseHWorld(): PhaseHWorld {
  const alice = principal({
    actorId: 'actor_hin_alice',
    customerId: 'cust_hin_alice',
    identityId: 'idn_hin_alice',
    sessionId: 'sess_hin_alice',
    persona: 'hin_ready',
  });
  const bob = principal({
    actorId: 'actor_vault_bob',
    customerId: 'cust_vault_bob',
    identityId: 'idn_vault_bob',
    sessionId: 'sess_vault_bob',
    persona: 'vault_ready',
  });
  const licensee = principal({
    actorId: 'actor_data_licensee',
    customerId: 'cust_data_licensee',
    identityId: 'idn_data_licensee',
    sessionId: 'sess_data_licensee',
    persona: 'data_licensee',
  });
  const sessions: SessionDirectory = new Map([
    [PHASE_H_TOKEN, alice],
    [PHASE_H_BOB_TOKEN, bob],
    [PHASE_H_LICENSEE_TOKEN, licensee],
  ]);
  const surface = new PhaseHProductSurface();
  const runtime: ConsumerBffRuntime = {
    bff: {
      featureStub: (group: string) =>
        Object.freeze({
          group,
          availability: 'AVAILABLE_SIMULATION',
          productionActive: false,
        }),
    } as unknown as ConsumerBff,
    sessions,
    nativeEconomy: createNativeEconomySurface(),
    phaseH: surface,
  };
  return {
    surface,
    runtime,
    alice,
    bob,
    licensee,
    async handle(request) {
      return await handleConsumerBff(runtime, {
        method: request.method,
        path: request.path,
        query: request.query ?? {},
        body: request.body ?? {},
        authorization: request.authorization ?? `Bearer ${PHASE_H_TOKEN}`,
      });
    },
    startHttp() {
      return startConsumerBff({ runtime });
    },
  };
}
