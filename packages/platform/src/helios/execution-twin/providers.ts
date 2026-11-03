import { createHash } from 'node:crypto';

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import type { HeliosProviderOrderPort, ProviderSubmitRequest, ProviderSubmitResult } from '../order-lifecycle/provider-port.ts';
import { SandboxHeliosProviderPort } from '../order-lifecycle/sandbox-provider.ts';
import type { ExecutionTwinEnvironmentKind, ExecutionTwinProviderKind } from './taxonomy.ts';
import { environmentPermitsProviderSubmit } from './taxonomy.ts';

export type ExecutionTwinProvider = {
  readonly kind: ExecutionTwinProviderKind;
  readonly environment: ExecutionTwinEnvironmentKind;
  readonly liveProviderConnected: false;
  readonly productionAuthorized: false;
  readonly permitsExternalNetwork: false;
  readonly heliosProviderPort: HeliosProviderOrderPort | null;
  describeAssumptions(): readonly string[];
  /** Guard rail: historical replay must never reach a live adapter surface. */
  assertLiveApiSurfaceBlocked(): void;
};

class HistoricalReplayProviderPort implements HeliosProviderOrderPort {
  readonly providerId = 'historical_replay_fixture_v1';
  readonly environment = 'SIMULATION' as const;
  readonly liveProviderConnected = false as const;

  private liveApiInvoked = false;

  submit(request: ProviderSubmitRequest): ProviderSubmitResult {
    this.assertNotLive();
    const providerOrderId = `hist_${createHash('sha256').update(request.externalOperationId).digest('hex').slice(0, 16)}`;
    return Object.freeze({
      outcome: 'ACKNOWLEDGED',
      providerOrderId,
      evidenceRef: `ev_hist_${request.externalOperationId}`,
    });
  }

  query(): { readonly found: false; readonly evidenceRef: string | null } {
    this.assertNotLive();
    return { found: false, evidenceRef: null };
  }

  cancel(): { readonly outcome: 'UNAVAILABLE'; readonly message: string } {
    this.assertNotLive();
    return { outcome: 'UNAVAILABLE', message: 'historical replay is read-only' };
  }

  verifyWebhook(): { readonly verified: false; readonly reason: 'MALFORMED' } {
    this.assertNotLive();
    return { verified: false, reason: 'MALFORMED' };
  }

  /** Test hook — simulates an accidental live API call from historical mode. */
  invokeLiveProviderApiForTest(): never {
    this.liveApiInvoked = true;
    throw new Error('HISTORICAL_REPLAY_LIVE_API_FORBIDDEN');
  }

  wasLiveApiInvoked(): boolean {
    return this.liveApiInvoked;
  }

  private assertNotLive(): void {
    if (this.liveApiInvoked) {
      throw new Error('HISTORICAL_REPLAY_LIVE_API_FORBIDDEN');
    }
  }
}

class PaperSimulationProviderPort implements HeliosProviderOrderPort {
  readonly providerId = 'paper_simulation_v1';
  readonly environment = 'PAPER' as const;
  readonly liveProviderConnected = false as const;
  readonly #seed: string;

  constructor(seed: string) {
    this.#seed = seed;
  }

  submit(request: ProviderSubmitRequest): ProviderSubmitResult {
    const providerOrderId = `paper_${createHash('sha256').update(`${this.#seed}:${request.externalOperationId}`).digest('hex').slice(0, 16)}`;
    return Object.freeze({
      outcome: 'ACKNOWLEDGED',
      providerOrderId,
      evidenceRef: `ev_paper_${providerOrderId}`,
    });
  }

  query(): { readonly found: false; readonly evidenceRef: string | null } {
    return { found: false, evidenceRef: null };
  }

  cancel(): { readonly outcome: 'CANCEL_ACKNOWLEDGED'; readonly evidenceRef: string } {
    return { outcome: 'CANCEL_ACKNOWLEDGED', evidenceRef: 'ev_paper_cancel' };
  }

  verifyWebhook(): { readonly verified: false; readonly reason: 'MALFORMED' } {
    return { verified: false, reason: 'MALFORMED' };
  }
}

class ShadowProvider implements ExecutionTwinProvider {
  readonly kind = 'ShadowProvider' as const;
  readonly environment: ExecutionTwinEnvironmentKind;
  readonly liveProviderConnected = false as const;
  readonly productionAuthorized = false as const;
  readonly permitsExternalNetwork = false as const;
  readonly heliosProviderPort = null;

  constructor(environment: ExecutionTwinEnvironmentKind = 'SHADOW') {
    this.environment = environment;
  }

  describeAssumptions(): readonly string[] {
    return Object.freeze(['forward_shadow_no_provider_submit']);
  }

  assertLiveApiSurfaceBlocked(): void {
    /* shadow never attaches a live port */
  }
}

class LiveProviderBlocked implements ExecutionTwinProvider {
  readonly kind = 'LiveProvider' as const;
  readonly environment = 'LIVE' as const;
  readonly liveProviderConnected = false as const;
  readonly productionAuthorized = false as const;
  readonly permitsExternalNetwork = false as const;
  readonly heliosProviderPort = null;

  describeAssumptions(): readonly string[] {
    return Object.freeze(['live_disabled_os02']);
  }

  assertLiveApiSurfaceBlocked(): void {
    throw new Error('LIVE_EXECUTION_TWIN_DISABLED');
  }
}

function wrapSandbox(seed: string): HeliosProviderOrderPort {
  const port = new SandboxHeliosProviderPort();
  const originalSubmit = port.submit.bind(port);
  port.submit = (request: ProviderSubmitRequest) => {
    const deterministicExternalId = createHash('sha256')
      .update(`${seed}:${request.externalOperationId}`)
      .digest('hex')
      .slice(0, 32);
    return originalSubmit({
      ...request,
      externalOperationId: deterministicExternalId,
    });
  };
  return port;
}

export function createExecutionTwinProvider(input: {
  readonly environment: ExecutionTwinEnvironmentKind;
  readonly randomSeed: string;
  readonly now: UtcInstant;
}): ExecutionTwinProvider {
  void input.now;
  switch (input.environment) {
    case 'HISTORICAL_REPLAY': {
      const historicalPort = new HistoricalReplayProviderPort();
      return Object.freeze({
        kind: 'HistoricalProvider',
        environment: input.environment,
        liveProviderConnected: false as const,
        productionAuthorized: false as const,
        permitsExternalNetwork: false as const,
        heliosProviderPort: historicalPort,
        describeAssumptions: () => Object.freeze(['recorded_market_transcript', 'no_external_network']),
        assertLiveApiSurfaceBlocked: () => {
          if (historicalPort.wasLiveApiInvoked()) {
            throw new Error('HISTORICAL_REPLAY_LIVE_API_FORBIDDEN');
          }
        },
      });
    }
    case 'SHADOW':
      return new ShadowProvider(input.environment);
    case 'PAPER':
      return Object.freeze({
        kind: 'PaperProvider',
        environment: input.environment,
        liveProviderConnected: false as const,
        productionAuthorized: false as const,
        permitsExternalNetwork: false as const,
        heliosProviderPort: new PaperSimulationProviderPort(input.randomSeed),
        describeAssumptions: () => Object.freeze(['deterministic_paper_fills']),
        assertLiveApiSurfaceBlocked: () => {
          throw new Error('PAPER_MODE_LIVE_API_FORBIDDEN');
        },
      });
    case 'SANDBOX_LIVE_DATA':
      return Object.freeze({
        kind: 'SandboxProvider',
        environment: input.environment,
        liveProviderConnected: false as const,
        productionAuthorized: false as const,
        permitsExternalNetwork: false as const,
        heliosProviderPort: wrapSandbox(input.randomSeed),
        describeAssumptions: () => Object.freeze(['sandbox_helios_provider_port', 'live_data_simulated_execution']),
        assertLiveApiSurfaceBlocked: () => {
          throw new Error('SANDBOX_LIVE_DATA_LIVE_API_FORBIDDEN');
        },
      });
    case 'LIVE':
      return new LiveProviderBlocked();
  }
}

export function externalOperationIdForStep(seed: string, step: string): string {
  return createHash('sha256').update(`${seed}:${step}`).digest('hex').slice(0, 32);
}

export function assertEnvironmentProviderParity(
  environment: ExecutionTwinEnvironmentKind,
  provider: ExecutionTwinProvider,
): void {
  if (provider.environment !== environment) {
    throw new Error(`provider environment ${provider.environment} does not match twin ${environment}`);
  }
  if (environment === 'LIVE') {
    throw new Error('LIVE execution twin is disabled');
  }
  if (!environmentPermitsProviderSubmit(environment) && provider.heliosProviderPort != null) {
    throw new Error(`${environment} must not attach a submitting provider port`);
  }
}

export { HistoricalReplayProviderPort };

export function historicalReplayPortFrom(provider: ExecutionTwinProvider): HistoricalReplayProviderPort | null {
  if (provider.kind !== 'HistoricalProvider' || !provider.heliosProviderPort) {
    return null;
  }
  return provider.heliosProviderPort as HistoricalReplayProviderPort;
}
