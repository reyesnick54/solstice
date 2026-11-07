import type { EvidenceVault } from '@solstice/evidence';

export function sealExec12Evidence(vault: EvidenceVault, kind: string, detail: Record<string, unknown>): string {
  const sealed = vault.seal(kind, {
    ...detail,
    actorId: 'helios_exec12_reconciliation',
    grantsExecutionAuthority: false,
    authorizesFinancialExecution: false,
    grantsFinancialEffect: false,
    autoFixCanonicalRecords: false,
  });
  return sealed.evidenceId;
}
