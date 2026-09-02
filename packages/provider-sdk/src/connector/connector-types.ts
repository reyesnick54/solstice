/**
 * Wave 4 — extensible connector type interfaces.
 *
 * Only REST is implemented for the current provider set. Other types are
 * interface contracts for future connectors sharing the governed framework.
 */

import type { ConnectorFetchResult, ConnectorRequestContext, GovernedConnector } from './governed-connector.ts';
import type { ProviderDefinition } from './provider-definition.ts';

export type BaseConnectorContract = GovernedConnector;

export type RestConnectorContract = BaseConnectorContract & {
  readonly connectorKind: 'REST';
};

export type GraphQlConnectorContract = {
  readonly connectorKind: 'GRAPHQL';
  readonly definition: ProviderDefinition;
  query<T>(
    document: string,
    variables: Record<string, unknown>,
    context: ConnectorRequestContext,
  ): Promise<ConnectorFetchResult<T>>;
};

export type WebSocketConnectorContract = {
  readonly connectorKind: 'WEBSOCKET';
  readonly definition: ProviderDefinition;
  subscribe(
    channel: string,
    context: ConnectorRequestContext,
  ): Promise<ConnectorFetchResult<unknown>>;
};

export type FileBatchConnectorContract = {
  readonly connectorKind: 'FILE_BATCH';
  readonly definition: ProviderDefinition;
  ingestBatch(
    batchId: string,
    context: ConnectorRequestContext,
  ): Promise<ConnectorFetchResult<unknown>>;
};

export type DatabaseFederatedConnectorContract = {
  readonly connectorKind: 'DATABASE_FEDERATED';
  readonly definition: ProviderDefinition;
  federatedQuery(
    queryId: string,
    params: unknown,
    context: ConnectorRequestContext,
  ): Promise<ConnectorFetchResult<unknown>>;
};

export type EventStreamConnectorContract = {
  readonly connectorKind: 'EVENT_STREAM';
  readonly definition: ProviderDefinition;
  readStream(
    streamId: string,
    context: ConnectorRequestContext,
  ): Promise<ConnectorFetchResult<unknown>>;
};

export type WebhookConnectorContract = {
  readonly connectorKind: 'WEBHOOK';
  readonly definition: ProviderDefinition;
  receiveWebhook(
    payload: unknown,
    context: ConnectorRequestContext,
  ): Promise<ConnectorFetchResult<unknown>>;
};

export type SensorIoTGatewayConnectorContract = {
  readonly connectorKind: 'SENSOR_IOT_GATEWAY';
  readonly definition: ProviderDefinition;
  pollSensors(
    gatewayId: string,
    context: ConnectorRequestContext,
  ): Promise<ConnectorFetchResult<unknown>>;
};

export type ConnectorTypeContract =
  | RestConnectorContract
  | GraphQlConnectorContract
  | WebSocketConnectorContract
  | FileBatchConnectorContract
  | DatabaseFederatedConnectorContract
  | EventStreamConnectorContract
  | WebhookConnectorContract
  | SensorIoTGatewayConnectorContract;
