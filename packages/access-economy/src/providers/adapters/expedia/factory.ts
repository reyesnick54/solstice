/**
 * Expedia provider factory — selects sandbox adapter with fixture transport
 * unless an explicit provider is injected.
 */

import type { AccessProvider } from '../../types.ts';
import type { ProviderCredentialPort } from '../../security.ts';
import { NoOpProviderCredentialPort } from '../../security.ts';
import { createSandboxExpediaProvider } from './sandbox.ts';
import { createSimulationExpediaProvider } from './simulation.ts';
import { resolveExpediaCredentials } from './credentials.ts';
import type { ExpediaProviderTransport } from './transport.ts';
import { createFixtureExpediaSandboxTransport } from './transport.ts';

export type ExpediaProviderFactoryInput = {
  readonly transport?: ExpediaProviderTransport;
  readonly credentials?: ProviderCredentialPort;
  readonly preferSimulation?: boolean;
};

export function createExpediaProvider(input: ExpediaProviderFactoryInput = {}): AccessProvider {
  if (input.preferSimulation === true) {
    return createSimulationExpediaProvider();
  }
  return createSandboxExpediaProvider({
    transport: input.transport ?? createFixtureExpediaSandboxTransport(),
    credentials: input.credentials ?? new NoOpProviderCredentialPort(),
  });
}

export async function resolveExpediaIntegrationState(
  credentials: ProviderCredentialPort = new NoOpProviderCredentialPort(),
): Promise<'CREDENTIALS_REQUIRED' | 'SANDBOX_AVAILABLE' | 'SIMULATED'> {
  const bundle = await resolveExpediaCredentials(credentials);
  if (bundle.state === 'SANDBOX_READY') {
    return 'SANDBOX_AVAILABLE';
  }
  return 'CREDENTIALS_REQUIRED';
}
