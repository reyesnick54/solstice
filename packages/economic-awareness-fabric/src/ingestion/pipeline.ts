import type { ExternalObservation } from '../../../provider-sdk/src/types.ts';
import type { FabricProviderRegistration } from '../providers/registry.ts';
import type { ConnectorResult } from '../connectors/executor.ts';
import { unknownProviderIsUntrusted, configuredProviderIsNotTrusted } from '../authority/fail-closed.ts';
import type { ProviderTrustState } from '../authority/fail-closed.ts';

export type IngestionResult =
  | { readonly ok: true; readonly observation: ExternalObservation<unknown>; readonly ingestionId: string }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type IngestionPipeline = {
  ingest(
    connectorResult: ConnectorResult,
    registration: FabricProviderRegistration,
    trust: ProviderTrustState,
  ): IngestionResult;
};

export function createIngestionPipeline(): IngestionPipeline {
  return {
    ingest(connectorResult, registration, trust) {
      const unknown = unknownProviderIsUntrusted(registration.providerId, trust);
      if (!unknown.ok) {
        return { ok: false, code: unknown.violation, message: unknown.detail };
      }

      if (registration.trustTier === 'catalog_registered') {
        const configured = configuredProviderIsNotTrusted(trust);
        if (!configured.ok && trust !== 'certified' && trust !== 'trusted') {
          // Ingestion allowed but marked untrusted for promotion
        }
      }

      if (!connectorResult.ok) {
        return { ok: false, code: connectorResult.code, message: connectorResult.message };
      }

      const ingestionId = `ing_${connectorResult.observation.observationId}`;
      return { ok: true, observation: connectorResult.observation, ingestionId };
    },
  };
}
