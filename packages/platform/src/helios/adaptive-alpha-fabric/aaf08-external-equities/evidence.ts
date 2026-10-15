/**
 * Seal AAF08 source-state outcomes into the Evidence Vault.
 */

import type { EvidenceVault } from '../../../../../evidence/src/vault.ts';
import type { UtcInstant } from '../../../../../domain/src/time.ts';

export function sealAaf08SourceStateEvidence(
  vault: EvidenceVault | undefined,
  kind: string,
  detail: Record<string, unknown>,
): string | null {
  if (!vault) return null;
  const sealed = vault.seal(kind, {
    ...detail,
    plane: 'helios_aaf08_external_equities',
    actorId: 'helios_aaf08_observation_plane',
    grantsExecutionAuthority: false,
    authorizesFinancialExecution: false,
    grantsFinancialEffect: false,
  });
  return sealed.evidenceId;
}

export function sealAaf08IngestFailure(
  vault: EvidenceVault | undefined,
  input: {
    readonly code: string;
    readonly message: string;
    readonly providerId: string;
    readonly instrumentId: string | null;
    readonly observedAt: UtcInstant;
  },
): string | null {
  return sealAaf08SourceStateEvidence(vault, 'helios.aaf08.ingest.failure', {
    code: input.code,
    message: input.message,
    providerId: input.providerId,
    instrumentId: input.instrumentId,
    observedAt: input.observedAt,
  });
}
