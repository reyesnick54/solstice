import { sha256Text } from '../../supply-chain/inventory.ts';
import { createProviderAcceptanceFixture, missingEvidenceFor } from '../../providers/fixture.ts';
import { buildAcceptanceReport, buildProductionProviderMatrix } from '../../providers/report.ts';
import type { AcceptanceState, ProductionProviderMatrix, ProviderDomain } from '../../providers/types.ts';
import type { HsmQualificationState, ProviderAcceptanceMatrix, ProviderAcceptanceRow, ProviderLifecycleState } from './types.ts';

function mapDomain(domain: ProviderDomain): ProviderAcceptanceRow['domain'] {
  if (domain === 'HSM' || domain === 'KMS' || domain === 'SECRET_MANAGER') {
    return 'HSM';
  }
  if (domain === 'ORACLE_DATA_SOURCE') {
    return 'ORACLE';
  }
  if (domain === 'CUSTODY_PROVIDER') {
    return 'CUSTODY';
  }
  if (
    domain === 'IDENTITY_KYC' ||
    domain === 'SANCTIONS_PEP' ||
    domain === 'AML_TRANSACTION_MONITORING' ||
    domain === 'TRAVEL_RULE' ||
    domain === 'BANKING_REFERENCE'
  ) {
    return 'REGULATED';
  }
  return 'INFRASTRUCTURE';
}

function mapLifecycle(state: AcceptanceState, engineeringTested: boolean, externalEvidence: boolean, humanAccepted: boolean): ProviderLifecycleState {
  if (state === 'PRODUCTION_ELIGIBLE') {
    return 'PRODUCTION_ELIGIBLE';
  }
  if (state === 'HUMAN_ACCEPTED' || humanAccepted) {
    return 'HUMAN_ACCEPTED';
  }
  if (state === 'EXTERNAL_EVIDENCE_PROVIDED' || externalEvidence) {
    return 'EXTERNALLY_EVIDENCED';
  }
  if (state === 'ENGINEERING_TESTED' || engineeringTested) {
    return 'ENGINEERING_TESTED';
  }
  return 'UNCONFIGURED';
}

/**
 * Consume the actual Chunk 82 ProductionProviderMatrix.
 * Engineering-tested providers remain distinct from HUMAN_ACCEPTED
 * and PRODUCTION_ELIGIBLE. No provider is promoted without evidence.
 */
export function snapshotProviderAcceptance(): ProviderAcceptanceMatrix {
  const fixture = createProviderAcceptanceFixture();
  const inputs = fixture.suites.map((suite) =>
    Object.freeze({
      providerId: suite.providerId,
      domain: suite.domain,
      configured: true,
      suite,
      evidence: missingEvidenceFor(suite.providerId, suite.domain),
      humanAccepted: false,
      humanReviewerKind: null,
      nowUtc: fixture.nowUtc,
    }),
  );
  const report = buildAcceptanceReport(inputs, fixture.nowUtc);
  const matrix: ProductionProviderMatrix = buildProductionProviderMatrix(report.results);
  const rows: ProviderAcceptanceRow[] = matrix.rows.map((row) =>
    Object.freeze({
      providerId: row.providerId,
      domain: mapDomain(row.domain),
      state: mapLifecycle(
        row.productionEligible
          ? 'PRODUCTION_ELIGIBLE'
          : row.humanAccepted
            ? 'HUMAN_ACCEPTED'
            : row.externalEvidence
              ? 'EXTERNAL_EVIDENCE_PROVIDED'
              : row.engineeringTested
                ? 'ENGINEERING_TESTED'
                : 'NOT_CONFIGURED',
        row.engineeringTested,
        row.externalEvidence,
        row.humanAccepted,
      ),
      notes: row.engineeringTested
        ? 'Chunk 82 ENGINEERING_TESTED. Distinct from HUMAN_ACCEPTED and PRODUCTION_ELIGIBLE.'
        : 'Chunk 82 provider slot is not production eligible.',
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
    digest: sha256Text(
      `${matrix.matrixDigest}|${rows.map((row) => `${row.providerId}:${row.state}:${String(row.productionEligible)}`).join('|')}`,
    ),
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
    notes: 'Test fixture / simulation HSM cannot satisfy a policy requiring externally verified hardware. CONFIGURED_UNVERIFIED is not upgraded.',
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
