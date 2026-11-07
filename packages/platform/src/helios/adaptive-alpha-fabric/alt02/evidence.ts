/**
 * HELIOS ALT02 — seal rights-firewall decisions in the Evidence Vault.
 */

import type { EvidenceVault } from '@solstice/evidence';
import type { AlternativeDataGateDecision } from '@solstice/provider-sdk';

export function sealAlt02GateEvidence(
  vault: EvidenceVault | undefined,
  decision: AlternativeDataGateDecision,
  detail: Record<string, unknown> = {},
): string | null {
  if (!vault) return null;
  const sealed = vault.seal('helios.alt02.data_rights_gate', {
    ...detail,
    decision,
    plane: 'helios_alt02_alternative_data_rights',
    actorId: 'helios_alt02_firewall',
    grantsExecutionAuthority: false,
    authorizesFinancialExecution: false,
    grantsFinancialEffect: false,
  });
  return sealed.evidenceId;
}

export function sealAlt02ManifestRegistration(
  vault: EvidenceVault | undefined,
  input: { readonly manifestId: string; readonly providerId: string; readonly sourceId: string; readonly licenseClass: string },
): string | null {
  if (!vault) return null;
  const sealed = vault.seal('helios.alt02.rights_manifest_registered', {
    ...input,
    grantsExecutionAuthority: false,
  });
  return sealed.evidenceId;
}
