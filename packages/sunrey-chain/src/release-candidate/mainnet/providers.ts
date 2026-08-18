import { sha256Text } from '../../supply-chain/inventory.ts';
import type { HsmQualificationState, ProviderAcceptanceMatrix, ProviderAcceptanceRow, ProviderLifecycleState } from './types.ts';

/**
 * Consume the current repository provider surface (Chunk 66/68/69 and the
 * Chunk 82 acceptance vocabulary). No provider is promoted to production
 * eligible without external evidence and human acceptance.
 */
const PROVIDER_ROWS: readonly Omit<ProviderAcceptanceRow, 'productionEligible'>[] = [
  { providerId: 'infra.local', domain: 'INFRASTRUCTURE', state: 'ENGINEERING_TESTED', notes: 'Local/simulation infrastructure harness. Not a production cloud account.' },
  { providerId: 'infra.aws', domain: 'INFRASTRUCTURE', state: 'UNCONFIGURED', notes: 'AWS adapter present; production credentials absent.' },
  { providerId: 'infra.azure', domain: 'INFRASTRUCTURE', state: 'UNCONFIGURED', notes: 'Azure adapter present; production credentials absent.' },
  { providerId: 'infra.gcp', domain: 'INFRASTRUCTURE', state: 'UNCONFIGURED', notes: 'GCP adapter present; production credentials absent.' },
  { providerId: 'infra.kubernetes', domain: 'INFRASTRUCTURE', state: 'UNCONFIGURED', notes: 'Kubernetes adapter present; cluster unconfigured.' },
  { providerId: 'kms.vault', domain: 'HSM', state: 'UNCONFIGURED', notes: 'Vault adapter present; production HSM evidence absent.' },
  { providerId: 'hsm.simulation', domain: 'HSM', state: 'ENGINEERING_TESTED', notes: 'Ceremony/test fixture HSM. Cannot satisfy EXTERNAL_HSM_VERIFIED.' },
  { providerId: 'oracle.production-candidate', domain: 'ORACLE', state: 'ENGINEERING_TESTED', notes: 'Chunk 68 onboarding exists. Provider agreements absent.' },
  { providerId: 'custody.simulation', domain: 'CUSTODY', state: 'ENGINEERING_TESTED', notes: 'Simulation signer. External HSM not verified.' },
  { providerId: 'exchange.sandbox', domain: 'EXCHANGE', state: 'ENGINEERING_TESTED', notes: 'Sandbox/regulated-feed only. Live trading disabled.' },
  { providerId: 'identity.kyc', domain: 'REGULATED', state: 'UNCONFIGURED', notes: 'LIVE_EXTERNAL_KYC remains false.' },
  { providerId: 'payments.rails', domain: 'REGULATED', state: 'UNCONFIGURED', notes: 'LIVE_BANKING_RAILS remains false.' },
];

export function snapshotProviderAcceptance(): ProviderAcceptanceMatrix {
  const rows: ProviderAcceptanceRow[] = PROVIDER_ROWS.map((row) =>
    Object.freeze({
      ...row,
      productionEligible: false as const,
    }),
  );
  const byState = (state: ProviderLifecycleState): readonly string[] =>
    Object.freeze(rows.filter((row) => row.state === state).map((row) => row.providerId));
  return Object.freeze({
    rows: Object.freeze(rows),
    unconfigured: byState('UNCONFIGURED'),
    engineeringTested: byState('ENGINEERING_TESTED'),
    externallyEvidenced: byState('EXTERNALLY_EVIDENCED'),
    humanAccepted: byState('HUMAN_ACCEPTED'),
    productionEligible: Object.freeze(rows.filter((row) => row.productionEligible).map((row) => row.providerId)),
    digest: sha256Text(rows.map((row) => `${row.providerId}:${row.state}:${String(row.productionEligible)}`).join('|')),
  });
}

export function reportHsmState(): {
  readonly state: HsmQualificationState;
  readonly simulationSatisfiesExternalHardware: false;
  readonly fixtureSatisfiesExternalHardware: false;
  readonly notes: string;
} {
  return Object.freeze({
    state: 'SIMULATION_HSM',
    simulationSatisfiesExternalHardware: false,
    fixtureSatisfiesExternalHardware: false,
    notes: 'Test fixture / simulation HSM cannot satisfy a policy requiring externally verified hardware.',
  });
}

export function rejectFixtureHsmAsExternal(state: HsmQualificationState, claimedExternal: boolean): void {
  if (claimedExternal && (state === 'SIMULATION_HSM' || state === 'SOFTWARE_SECURE_PROVIDER')) {
    throw new TypeError('test fixture HSM cannot satisfy external HSM');
  }
}

export function rejectUnconfiguredAsProductionEligible(matrix: ProviderAcceptanceMatrix): void {
  if (matrix.productionEligible.length > 0 && matrix.externallyEvidenced.length === 0) {
    throw new TypeError('production eligibility requires external evidence');
  }
}
