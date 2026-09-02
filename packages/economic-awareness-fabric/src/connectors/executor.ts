import type { ExternalObservation } from '../../../provider-sdk/src/types.ts';
import type { FabricProviderRegistration } from '../providers/registry.ts';

export type ConnectorMode = 'fixture' | 'preview' | 'simulation' | 'live';

export type ConnectorRequest = {
  readonly providerId: string;
  readonly capability: string;
  readonly parameters: Readonly<Record<string, string>>;
  readonly requestId: string;
};

export type ConnectorResult =
  | { readonly ok: true; readonly observation: ExternalObservation<unknown>; readonly mode: ConnectorMode }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type FabricConnector = {
  readonly connectorId: string;
  readonly providerId: string;
  readonly mode: ConnectorMode;
  execute(request: ConnectorRequest): Promise<ConnectorResult>;
};

export type ConnectorExecutor = {
  register(connector: FabricConnector): void;
  execute(request: ConnectorRequest, registration: FabricProviderRegistration): Promise<ConnectorResult>;
};

export class InMemoryConnectorExecutor implements ConnectorExecutor {
  private readonly connectors = new Map<string, FabricConnector>();

  register(connector: FabricConnector): void {
    const key = `${connector.providerId}:${connector.connectorId}`;
    if (this.connectors.has(key)) {
      throw new Error(`connector already registered: ${key}`);
    }
    this.connectors.set(key, connector);
  }

  async execute(request: ConnectorRequest, registration: FabricProviderRegistration): Promise<ConnectorResult> {
    const key = `${registration.providerId}:${registration.connectorId}`;
    const connector = this.connectors.get(key);
    if (!connector) {
      return { ok: false, code: 'CONNECTOR_NOT_FOUND', message: `no connector for ${key}` };
    }
    if (!registration.active) {
      return { ok: false, code: 'CONNECTOR_INACTIVE', message: `provider ${registration.providerId} inactive` };
    }
    return connector.execute(request);
  }
}
