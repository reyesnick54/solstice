/**
 * Production handoff package, configuration baseline, evidence seal,
 * readiness report, and observed-production derivation.
 */

import { ENVIRONMENT } from '../../../config/src/index.ts';
import { consumeAuditEvidence, consumeCandidateV2, consumeMainnetRc, consumeProviderAcceptance } from '../production-ceremony/bindings.ts';
import { evaluateCurrentProductionState } from '../production-ceremony/eligibility.ts';
import { CANDIDATE_V2_ID } from '../mainnet/candidate-v2/identity.ts';
import { FIRST_MAINNET_RC_ID } from '../release-candidate/mainnet/types.ts';
import { defaultActivationMatrix } from '../mainnet/capabilities.ts';
import { handoffHash, assertNoSecrets } from './hash.ts';
import {
  createAccessInventory,
  createResponsibilityMatrix,
  createSloPolicy,
  createSystemInventory,
  defaultCapabilityInventory,
} from './catalog.ts';
import { classifyEvidence, recordOperatorAcceptance, rejectFixtureAsRealAcceptance } from './control.ts';
import {
  HANDOFF_NOW_UTC,
  PRODUCTION_HANDOFF_SCHEMA_VERSION,
  type EvidenceClass,
  type OperatorAcceptanceRecord,
  type ProductionConfigurationBaseline,
  type ProductionEvidenceSeal,
  type ProductionHandoffPackage,
  type ProductionHandoffReport,
  type ProductionHandoffState,
  type ProductionOperationalBaseline,
  type ProductionOperationalReadinessReport,
} from './types.ts';

export function deriveObservedProduction(input: {
  readonly evidenceClass: EvidenceClass;
  readonly rehearsal: boolean;
  readonly fixture: boolean;
  readonly isolatedTest: boolean;
  readonly humanAuthorizationPresent: boolean;
  readonly actualProductionEvidencePresent: boolean;
}): boolean {
  if (input.rehearsal || input.fixture || input.isolatedTest) {
    return false;
  }
  if (input.evidenceClass !== 'PRODUCTION_OBSERVED') {
    return false;
  }
  if (!input.humanAuthorizationPresent || !input.actualProductionEvidencePresent) {
    return false;
  }
  if (ENVIRONMENT !== 'simulation') {
    throw new TypeError('ENVIRONMENT must remain simulation');
  }
  return true;
}

export function evaluateHandoffState(input: {
  readonly engineeringReady: boolean;
  readonly externalAccepted: boolean;
  readonly operatorsAccepted: boolean;
  readonly packageAssembled: boolean;
}): ProductionHandoffState {
  if (!input.engineeringReady || !input.packageAssembled) {
    return 'HANDOFF_INCOMPLETE';
  }
  if (!input.externalAccepted) {
    return input.engineeringReady ? 'AWAITING_EXTERNAL_ACCEPTANCE' : 'HANDOFF_INCOMPLETE';
  }
  if (!input.operatorsAccepted) {
    return 'AWAITING_OPERATOR_ACCEPTANCE';
  }
  return 'PRODUCTION_HANDOFF_PACKAGE_COMPLETE';
}

export function createConfigurationBaseline(approvedConfigurationHash: string): ProductionConfigurationBaseline {
  return Object.freeze({
    baselineId: 'cfg_baseline_handoff_1',
    approvedConfigurationHash,
    retainedAtUtc: HANDOFF_NOW_UTC,
    notes: 'Approved production configuration hash. Future drift is evaluated against this baseline.',
  });
}

export function detectConfigurationDrift(baseline: ProductionConfigurationBaseline, observedHash: string): 'MATCH' | 'DRIFT' {
  if (baseline.approvedConfigurationHash !== observedHash) {
    return 'DRIFT';
  }
  return 'MATCH';
}

export function rejectWrongConfigurationBaseline(baseline: ProductionConfigurationBaseline, observedHash: string): void {
  if (detectConfigurationDrift(baseline, observedHash) === 'DRIFT') {
    throw new TypeError('wrong configuration baseline detected');
  }
}

export function createOperationalBaseline(root = process.cwd()): ProductionOperationalBaseline {
  const candidate = consumeCandidateV2(root);
  const configuration = createConfigurationBaseline(candidate.hash ?? handoffHash({ software: 'sunrey-chain', protocol: '1' }));
  const baseline = {
    schemaVersion: PRODUCTION_HANDOFF_SCHEMA_VERSION,
    softwareVersion: 'sunrey-chain/0.1.0',
    protocolVersion: '1',
    policyVersions: Object.freeze({
      monetary: 'chunk-71',
      fee: 'chunk-73',
      moonrey: 'chunk-74',
      governance: 'chunk-79',
    }),
    configuration,
    topologyHash: handoffHash({ validators: 7, sentries: 14 }),
    providerVersions: Object.freeze({ chunk82: 'engineering-tested' }),
    schemaVersions: Object.freeze({ ops: '1', handoff: '1', ledger: 'canonical' }),
    resourceExpectations: Object.freeze({
      validators: '7',
      sentries: '14',
      finality: 'engineering-fixture',
    }),
    activeCapabilities: Object.freeze(defaultActivationMatrix().filter((row) => row.runtime_enabled).map((row) => row.capability)),
    hash: '',
  };
  return Object.freeze({ ...baseline, hash: handoffHash({ ...baseline, hash: '' }) });
}

export function createEvidenceSeal(input: {
  readonly releaseHash: string;
  readonly candidateHash: string;
  readonly genesisHash: string;
  readonly launchReportHash: string | null;
  readonly stabilizationReportHash: string | null;
  readonly providerMatrixHash: string;
  readonly auditStateHash: string;
  readonly configurationBaselineHash: string;
  readonly operatorAcceptanceHash: string;
  readonly activeCapabilityMatrixHash: string;
}): ProductionEvidenceSeal {
  const included = Object.freeze({ ...input });
  return Object.freeze({
    sealId: 'seal_prod_handoff_1',
    included,
    sealHash: handoffHash(included),
    provesIntegrityOfIncludedRecords: true,
    provesLegalCompliance: false,
    provesSecurityPerfection: false,
    provesFinancialSafety: false,
  });
}

export function verifyEvidenceSeal(seal: ProductionEvidenceSeal): boolean {
  return seal.sealHash === handoffHash(seal.included);
}

export function rejectTamperedEvidenceSeal(seal: ProductionEvidenceSeal): void {
  if (!verifyEvidenceSeal(seal)) {
    throw new TypeError('evidence-seal tamper detected');
  }
}

export function fixtureOperatorAcceptances(): readonly OperatorAcceptanceRecord[] {
  const roles = [
    'PROTOCOL_AUTHORITY',
    'SECURITY_AUTHORITY',
    'VALIDATOR_OPERATIONS',
    'INFRASTRUCTURE',
    'DATABASE',
    'RELEASE_AUTHORITY',
    'TREASURY',
    'ORACLE',
    'EXCHANGE',
    'CUSTODY',
    'COMPLIANCE_OPERATIONS',
    'INCIDENT_COMMAND',
    'OPERATIONS_AUTHORITY',
  ] as const;
  const records = roles.map((role) => {
    const record = recordOperatorAcceptance({
      operatorId: `fixture_${role.toLowerCase()}`,
      role,
      actorKind: 'HUMAN',
      systemsAccepted: [role],
      runbooksReviewed: ['docs/runbooks/production-handoff.md', 'docs/runbooks/day-2-operations.md'],
      accessGranted: true,
      accessVerified: true,
      onCallResponsibility: true,
      fixture: true,
    });
    rejectFixtureAsRealAcceptance(record);
    return record;
  });
  return Object.freeze(records);
}

export function assembleHandoffPackage(root = process.cwd()): ProductionHandoffPackage {
  const state = evaluateCurrentProductionState(root);
  const candidate = consumeCandidateV2(root);
  const rc = consumeMainnetRc(root);
  const provider = consumeProviderAcceptance(root);
  const audit = consumeAuditEvidence(root);
  const inventory = createSystemInventory();
  const ownership = createResponsibilityMatrix();
  const capabilities = defaultCapabilityInventory();
  const engineeringReady = candidate.present && rc.present;
  const externalAccepted = false;
  const operatorsAccepted = false;
  const handoffState = evaluateHandoffState({
    engineeringReady,
    externalAccepted,
    operatorsAccepted,
    packageAssembled: true,
  });
  const evidenceClass = classifyEvidence({
    claimed: 'REHEARSAL',
    sourceClass: 'REHEARSAL',
    rehearsal: true,
    fixture: true,
    isolatedTest: true,
  });
  const observedProduction = deriveObservedProduction({
    evidenceClass,
    rehearsal: true,
    fixture: true,
    isolatedTest: true,
    humanAuthorizationPresent: false,
    actualProductionEvidencePresent: false,
  });
  const draft = {
    schemaVersion: PRODUCTION_HANDOFF_SCHEMA_VERSION,
    packageId: 'pkg_prod_handoff_rehearsal_1',
    mainnetRcId: FIRST_MAINNET_RC_ID,
    mainnetRcHash: rc.hash,
    candidateV2Id: CANDIDATE_V2_ID,
    candidateV2Hash: candidate.hash,
    productionEnvironment: 'simulation' as const,
    genesisAuthorizationPackageHash: state.eligibility === 'GENESIS_AUTHORIZATION_PACKAGE_COMPLETE' ? handoffHash(state) : null,
    launchExecutionReportHash: null,
    launchExecutionExists: false,
    postGenesisPhase: 'REHEARSAL_ONLY',
    postGenesisStatus: 'NOT_OBSERVED',
    activeCapabilities: capabilities,
    providerMatrixHash: handoffHash(provider),
    securityReviewState: audit.externalReviewStatus,
    governanceState: 'chunk-79-bounded',
    runbooks: Object.freeze([
      'docs/runbooks/production-handoff.md',
      'docs/runbooks/day-2-operations.md',
      'docs/runbooks/production-genesis-ceremony.md',
    ]),
    serviceInventoryHash: inventory.hash,
    operatorOwnershipHash: ownership.hash,
    evidenceArchiveHash: handoffHash({ candidate: candidate.hash, rc: rc.hash, audit: audit.notes }),
    evidenceClass,
    state: handoffState,
    observedProduction,
    hash: '',
  };
  if (observedProduction !== false) {
    throw new TypeError('rehearsal assembly must not claim observed production');
  }
  return Object.freeze({ ...draft, hash: handoffHash({ ...draft, hash: '' }) });
}

export function createReadinessReport(root = process.cwd()): ProductionOperationalReadinessReport {
  const pkg = assembleHandoffPackage(root);
  const audit = consumeAuditEvidence(root);
  const provider = consumeProviderAcceptance(root);
  const baseline = createOperationalBaseline(root);
  const acceptances = fixtureOperatorAcceptances();
  const externalGaps = Object.freeze([
    'MISSING_EXTERNAL_SECURITY_REVIEW',
    'MISSING_LEGAL_APPROVAL',
    'MISSING_PROVIDER_PRODUCTION_ELIGIBILITY',
    'MISSING_HSM_PROVIDER_ATTESTATION',
  ]);
  const humanGaps = Object.freeze([
    'REAL_OPERATOR_ACCEPTANCE_ABSENT',
    'REAL_HUMAN_AUTHORIZATION_ABSENT',
    'AI_CANNOT_GENERATE_PRODUCTION_ACCEPTANCE',
  ]);
  const draft = {
    schemaVersion: PRODUCTION_HANDOFF_SCHEMA_VERSION,
    engineeringReadiness: 'ENGINEERING_READY_FOR_HUMAN_REVIEW',
    externalProviderReadiness: provider.acceptanceStatus,
    auditStatus: audit.externalReviewStatus,
    legalRegulatoryStatus: 'EXTERNAL_VERIFICATION_REQUIRED',
    securityBlockers: Object.freeze([...audit.openCritical, ...audit.openHigh, ...externalGaps]),
    operatorAcceptance: acceptances.every((row) => row.fixture)
      ? 'FIXTURE_REHEARSAL_ONLY'
      : 'HUMAN_ACCEPTED',
    configurationBaselineHash: baseline.configuration.approvedConfigurationHash,
    launchEvidence: pkg.launchExecutionExists ? 'LAUNCH_REPORT_BOUND' : 'NO_REAL_LAUNCH_EXECUTION',
    activeCapabilities: pkg.activeCapabilities,
    knownLimitations: Object.freeze([
      'ENVIRONMENT remains simulation',
      'LIVE_* flags remain false',
      'observedProduction=false',
      'no contractual SLO promises',
      'dress-rehearsal and fixture identities are unusable as production inputs',
    ]),
    externalGaps,
    humanGaps,
    observedProduction: pkg.observedProduction,
    handoffState: pkg.state,
    hash: '',
  };
  return Object.freeze({ ...draft, hash: handoffHash({ ...draft, hash: '' }) });
}

export function createHandoffReport(root = process.cwd()): ProductionHandoffReport {
  const pkg = assembleHandoffPackage(root);
  const inventory = createSystemInventory();
  const responsibility = createResponsibilityMatrix();
  const access = createAccessInventory();
  const slo = createSloPolicy();
  const baseline = createOperationalBaseline(root);
  const acceptances = fixtureOperatorAcceptances();
  const readiness = createReadinessReport(root);
  const seal = createEvidenceSeal({
    releaseHash: pkg.mainnetRcHash ?? 'ABSENT',
    candidateHash: pkg.candidateV2Hash ?? 'ABSENT',
    genesisHash: pkg.genesisAuthorizationPackageHash ?? 'ABSENT',
    launchReportHash: pkg.launchExecutionReportHash,
    stabilizationReportHash: null,
    providerMatrixHash: pkg.providerMatrixHash,
    auditStateHash: handoffHash(pkg.securityReviewState),
    configurationBaselineHash: baseline.configuration.approvedConfigurationHash,
    operatorAcceptanceHash: handoffHash(acceptances.map((row) => row.evidenceHash)),
    activeCapabilityMatrixHash: handoffHash(pkg.activeCapabilities),
  });
  rejectTamperedEvidenceSeal(seal);
  const draft = {
    schemaVersion: PRODUCTION_HANDOFF_SCHEMA_VERSION,
    package: pkg,
    inventory,
    responsibility,
    access,
    slo,
    baseline,
    seal,
    readiness,
    acceptances,
    observedProduction: pkg.observedProduction,
    hash: '',
  };
  assertNoSecrets(draft);
  return Object.freeze({ ...draft, hash: handoffHash({ ...draft, hash: '' }) });
}
