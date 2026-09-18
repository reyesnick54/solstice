import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ProviderEvidence } from './types.ts';

export function buildProviderEvidence(input: {
  readonly providerId: string;
  readonly providerObjectId: string | null;
  readonly providerTimestamp: UtcInstant | null;
  readonly arrivalTimestamp: UtcInstant;
  readonly correlationId: string;
  readonly operationId: string;
  readonly rawStatus: string | null;
}): ProviderEvidence {
  return Object.freeze({
    providerId: input.providerId,
    providerObjectId: input.providerObjectId,
    providerTimestamp: input.providerTimestamp,
    arrivalTimestamp: input.arrivalTimestamp,
    correlationId: input.correlationId,
    operationId: input.operationId,
    evidenceRef: null,
    rawStatus: input.rawStatus,
  });
}

export function sealProviderOrchestrationEvidence(
  vault: EvidenceVault,
  kind: string,
  detail: Record<string, unknown>,
): string {
  const sealed = vault.seal(kind, {
    ...detail,
    actorId: 'helios_provider_orchestration',
    grantsExecutionAuthority: false,
    authorizesFinancialExecution: false,
    grantsFinancialEffect: false,
  });
  return sealed.evidenceId;
}
