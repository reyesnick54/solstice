/**
 * One-command developer local environment.
 *
 * Reuses the existing public gateway / local chain adapter. This is not
 * a second chain implementation.
 */

import { startPublicGateway, type RunningGateway } from '../gateway/server.ts';
import { DeveloperPlatformEngine } from './portal.ts';
import type { WebhookTransport } from './webhooks.ts';

export type MockWebhookReceiver = {
  readonly url: string;
  readonly deliveries: { readonly headers: Readonly<Record<string, string>>; readonly body: string }[];
  readonly close: () => void;
};

export function createMockWebhookReceiver(): MockWebhookReceiver {
  const deliveries: { readonly headers: Readonly<Record<string, string>>; readonly body: string }[] = [];
  return {
    url: 'mock://local-webhook-receiver',
    deliveries,
    close() {
      deliveries.length = 0;
    },
  };
}

export function mockReceiverTransport(receiver: MockWebhookReceiver): WebhookTransport {
  return async (input) => {
    if (!input.url.startsWith('mock://')) {
      return { ok: false, reason: 'TRANSPORT' };
    }
    receiver.deliveries.push({ headers: input.headers, body: input.body });
    return { ok: true };
  };
}

export type LocalDeveloperStack = {
  readonly gateway: RunningGateway;
  readonly portal: DeveloperPlatformEngine;
  readonly receiver: MockWebhookReceiver;
  readonly labels: readonly string[];
  readonly close: () => Promise<void>;
};

export async function startLocalDeveloperStack(input: {
  readonly host?: string;
  readonly port?: number;
} = {}): Promise<LocalDeveloperStack> {
  const receiver = createMockWebhookReceiver();
  const portal = new DeveloperPlatformEngine({
    transport: mockReceiverTransport(receiver),
  });
  const gateway = await startPublicGateway({
    host: input.host ?? '127.0.0.1',
    port: input.port ?? 0,
    autoFinalize: true,
  });
  return {
    gateway,
    portal,
    receiver,
    labels: Object.freeze([
      'NON_PRODUCTION',
      'LOCAL_DEVNET',
      'chain=existing-local-adapter',
      'rpc=PUBLIC_API /v1',
      'explorer=projection',
      'oracle=mock',
      'exchange=mock',
      'webhook-receiver=mock',
    ]),
    async close() {
      receiver.close();
      await gateway.close();
    },
  };
}
