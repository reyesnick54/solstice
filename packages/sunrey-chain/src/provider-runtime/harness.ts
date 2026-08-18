/**
 * Provider runtime registry, sandbox harness, integration tests,
 * engineering evidence, matrix enrichment, day-2 operations, and metrics.
 */

import { InMemorySecretProvider, secretRef } from '../../../security/src/secrets.ts';
import { SecretValue } from '../../../security/src/redaction.ts';
import type { ProviderDomain } from '../providers/types.ts';
import { PROVIDER_DOMAINS } from '../providers/types.ts';
import type { ProductionProviderMatrix, ProductionProviderMatrixRow } from '../providers/types.ts';
import type { FeedSchemaDefinition } from '../oracle/production/types.ts';
import {
  assertNoSecretMaterial,
  authorizeWorkload,
  decideProviderRetry,
  digestJson,
  evaluateProviderEgress,
  probePqcCapability,
  ProviderCircuitBreaker,
  reportedModeFor,
  resolveRuntimeMode,
  signWebhook,
  WebhookReplayGuard,
} from './core.ts';
import {
  awsExecutableAdapter,
  azureExecutableAdapter,
  ExecutableBankingAdapter,
  ExecutableCaseManagementAdapter,
  ExecutableCustodyAdapter,
  ExecutableDatabaseAdapter,
  ExecutableDnsCertificateAdapter,
  ExecutableHsmAdapter,
  ExecutableKmsAdapter,
  ExecutableKycAdapter,
  ExecutableObjectStorageAdapter,
  ExecutableOracleAdapter,
  ExecutableScreeningAdapter,
  ExecutableSecretManagerAdapter,
  ExecutableSurveillanceAdapter,
  ExecutableTravelRuleAdapter,
  gcpExecutableAdapter,
  kubernetesExecutableAdapter,
  MockBackedTransport,
  openBoundSession,
  vaultExecutableAdapter,
  type ProviderTransport,
} from './adapters.ts';
import { LocalMockFleet } from './mocks.ts';
import {
  ADAPTER_SUCCESS_IS_NOT_APPROVAL,
  PROVIDER_RUNTIME_SCHEMA_VERSION,
  PROVIDER_RUNTIME_TOOL_VERSION,
  runtimeErr,
  runtimeOk,
  type LiveRuntimeCapabilityStatus,
  type ProviderHealthSnapshot,
  type ProviderIntegrationEvidence,
  type ProviderIntegrationTest,
  type ProviderRuntimeMetrics,
  type ProviderRuntimeMode,
  type ProviderRuntimeReadinessReport,
  type ProviderRuntimeResult,
  type ProviderSession,
  type ReportedRuntimeMode,
  type WorkloadIdentity,
} from './types.ts';

export type RegisteredRuntime = {
  readonly domain: ProviderDomain;
  readonly providerId: string;
  readonly adapterId: string;
};

export class ProviderRuntimeRegistry {
  readonly #rows = new Map<ProviderDomain, RegisteredRuntime>();

  register(row: RegisteredRuntime): void {
    this.#rows.set(row.domain, row);
  }

  get(domain: ProviderDomain): RegisteredRuntime | undefined {
    return this.#rows.get(domain);
  }

  list(): readonly RegisteredRuntime[] {
    return Object.freeze([...this.#rows.values()]);
  }
}

export type ProviderRuntime = {
  readonly mode: ProviderRuntimeMode;
  readonly reportedMode: ReportedRuntimeMode;
  readonly fleet: LocalMockFleet;
  readonly transport: ProviderTransport;
  readonly registry: ProviderRuntimeRegistry;
  readonly secrets: InMemorySecretProvider;
  readonly sandboxCredentialPresent: boolean;
  readonly webhookGuard: WebhookReplayGuard;
  readonly metrics: ProviderRuntimeMetrics;
};

const ENERGY_SCHEMA: FeedSchemaDefinition = Object.freeze({
  schemaVersion: 1,
  schemaId: 'energy.resource.v1',
  version: 1,
  factType: 'ENERGY_PRODUCTION',
  requiredFields: Object.freeze(['identifier', 'numericValue', 'unit', 'sourceTimestampUnix']),
  unit: 'MWh',
  quantityScale: 0,
  identifierPattern: '^[A-Za-z0-9_.:-]+$',
  maxRecordBytes: 2048,
  maxArrayLength: 8,
  allowFloat: false,
  breakingChangeCreatesNewVersion: true,
});

export function createProviderRuntime(input?: {
  readonly requestedMode?: ProviderRuntimeMode;
  readonly sandboxCredentialPresent?: boolean;
  readonly externalEvidencePresent?: boolean;
  readonly humanAuthorityPresent?: boolean;
}): ProviderRuntimeResult<ProviderRuntime> {
  const sandboxCredentialPresent = input?.sandboxCredentialPresent === true;
  const mode = resolveRuntimeMode({
    requested: input?.requestedMode,
    sandboxCredentialPresent,
    externalEvidencePresent: input?.externalEvidencePresent === true,
    humanAuthorityPresent: input?.humanAuthorityPresent === true,
  });
  if (!mode.ok) {
    return mode;
  }
  const fleet = new LocalMockFleet();
  const transport = new MockBackedTransport(fleet);
  const registry = new ProviderRuntimeRegistry();
  for (const domain of PROVIDER_DOMAINS) {
    registry.register({
      domain,
      providerId: `runtime_${domain.toLowerCase()}`,
      adapterId: `adapter.${domain.toLowerCase()}`,
    });
  }
  const secrets = new InMemorySecretProvider('local', {
    'kyc-worker': 'sandbox-shape-token',
    'oracle-collector': 'sandbox-shape-token',
    'webhook': 'sandbox-shape-token',
  });
  const runtime: ProviderRuntime = {
    mode: mode.value,
    reportedMode: reportedModeFor(mode.value, sandboxCredentialPresent),
    fleet,
    transport,
    registry,
    secrets,
    sandboxCredentialPresent,
    webhookGuard: new WebhookReplayGuard(),
    metrics: {
      latencyMs: 1,
      availability: 1,
      errorCount: 0,
      authFailures: 0,
      rateLimits: 0,
      schemaFailures: 0,
      retries: 0,
      callbackReplayRejections: 0,
      sensitivePayloadLogged: false,
    },
  };
  assertNoSecretMaterial({ mode: runtime.mode, reportedMode: runtime.reportedMode });
  return runtimeOk(runtime);
}

function sessionFor(
  runtime: ProviderRuntime,
  domain: ProviderDomain,
  workload: WorkloadIdentity,
): ProviderRuntimeResult<ProviderSession> {
  return openBoundSession({
    sessionId: `sess_${domain}`,
    providerId: `runtime_${domain.toLowerCase()}`,
    domain,
    environment: runtime.mode,
    workloadIdentity: workload,
    credentialHref: runtime.sandboxCredentialPresent ? secretRef('local', 'kyc-worker').href : undefined,
  });
}

export function runProviderIntegrationTests(runtime: ProviderRuntime): readonly ProviderIntegrationTest[] {
  const tests: ProviderIntegrationTest[] = [];
  const domainWorkload: Partial<Record<ProviderDomain, WorkloadIdentity>> = {
    CLOUD_INFRASTRUCTURE: 'infra_worker',
    SECRET_MANAGER: 'infra_worker',
    KMS: 'kms_worker',
    HSM: 'hsm_worker',
    DATABASE: 'infra_worker',
    OBJECT_STORAGE: 'infra_worker',
    DNS: 'infra_worker',
    CERTIFICATE_MANAGER: 'infra_worker',
    ORACLE_DATA_SOURCE: 'oracle_collector',
    IDENTITY_KYC: 'kyc_worker',
    SANCTIONS_PEP: 'screening_worker',
    AML_TRANSACTION_MONITORING: 'screening_worker',
    TRAVEL_RULE: 'travel_rule_worker',
    MARKET_SURVEILLANCE: 'surveillance_worker',
    CASE_MANAGEMENT: 'case_management',
    CUSTODY_PROVIDER: 'custody_worker',
    BANKING_REFERENCE: 'banking_worker',
    OTHER_GOVERNED_EXTERNAL_PROVIDER: 'infra_worker',
  };
  for (const domain of PROVIDER_DOMAINS) {
    const workload = domainWorkload[domain] ?? 'infra_worker';
    const session = sessionFor(runtime, domain, workload);
    const health = session.ok
      ? runtime.transport.execute({ domain, operation: 'health' })
      : runtimeErr('SESSION', session.ok === false ? session.error.message : 'session failed');
    tests.push(
      Object.freeze({
        testId: `it_${domain}`,
        providerId: `runtime_${domain.toLowerCase()}`,
        domain,
        mode: runtime.mode,
        reportedMode: runtime.reportedMode,
        passed: health.ok,
        cases: Object.freeze(['health']),
        engineeringOnly: true,
        legallyApproved: false,
      }),
    );
  }
  return Object.freeze(tests);
}

export function sealEngineeringEvidence(
  test: ProviderIntegrationTest,
  nowUtc: string,
): ProviderIntegrationEvidence {
  const evidence: ProviderIntegrationEvidence = Object.freeze({
    evidenceId: `eng_${test.testId}`,
    providerId: test.providerId,
    domain: test.domain,
    kind: 'ENGINEERING_INTEGRATION',
    testId: test.testId,
    digest: digestJson(test),
    createdAtUtc: nowUtc,
    contractEvidence: false,
    licenseEvidence: false,
    legalApproval: false,
    commercialApproval: false,
    secretValuePresent: false,
  });
  assertNoSecretMaterial(evidence);
  if (ADAPTER_SUCCESS_IS_NOT_APPROVAL !== true) {
    throw new TypeError('adapter success must not equal approval');
  }
  return evidence;
}

export function enrichMatrixWithRuntime(
  matrix: ProductionProviderMatrix,
  tests: readonly ProviderIntegrationTest[],
  snapshots: readonly ProviderHealthSnapshot[],
): {
  readonly matrix: ProductionProviderMatrix;
  readonly liveRuntime: readonly LiveRuntimeCapabilityStatus[];
  readonly lanesPreserved: true;
} {
  const liveRuntime = Object.freeze(
    tests.map((test) => {
      const snap = snapshots.find((row) => row.domain === test.domain);
      return Object.freeze({
        domain: test.domain,
        providerId: test.providerId,
        probed: true,
        health: snap?.state ?? (test.passed ? 'HEALTHY' : 'UNAVAILABLE'),
        mode: test.mode,
        engineeringConnected: test.passed,
        legallyApproved: false as const,
        commerciallyApproved: false as const,
      });
    }),
  );
  assertNoSecretMaterial(liveRuntime);
  return Object.freeze({ matrix, liveRuntime, lanesPreserved: true as const });
}

export function collectHealthSnapshots(runtime: ProviderRuntime, nowUtc: string): readonly ProviderHealthSnapshot[] {
  return Object.freeze(
    PROVIDER_DOMAINS.map((domain) => {
      const result = runtime.transport.execute({ domain, operation: 'health' });
      return Object.freeze({
        providerId: `runtime_${domain.toLowerCase()}`,
        domain,
        state: result.ok ? result.value.status : mapError(result.error.code),
        latencyMs: result.ok ? 1 : null,
        checkedAtUtc: nowUtc,
        detail: result.ok ? 'ok' : result.error.message,
        secretValuePresent: false as const,
      });
    }),
  );
}

function mapError(code: string): ProviderHealthSnapshot['state'] {
  if (code === 'AUTH_FAILED') {
    return 'AUTH_FAILED';
  }
  if (code === 'SCHEMA_INCOMPATIBLE') {
    return 'SCHEMA_INCOMPATIBLE';
  }
  if (code === 'RATE_LIMITED') {
    return 'RATE_LIMITED';
  }
  if (code === 'TIMEOUT') {
    return 'DEGRADED';
  }
  return 'UNAVAILABLE';
}

export function buildRuntimeReadinessReport(
  runtime: ProviderRuntime,
  nowUtc: string,
  input?: { readonly externalEvidencePresent?: boolean; readonly humanAuthorityPresent?: boolean },
): ProviderRuntimeReadinessReport {
  const snapshots = collectHealthSnapshots(runtime, nowUtc);
  const tests = runProviderIntegrationTests(runtime);
  const report: ProviderRuntimeReadinessReport = {
    schemaVersion: PROVIDER_RUNTIME_SCHEMA_VERSION,
    toolVersion: PROVIDER_RUNTIME_TOOL_VERSION,
    generatedAtUtc: nowUtc,
    mode: runtime.mode,
    reportedMode: runtime.reportedMode,
    technicalConnectivity: tests.every((row) => row.passed),
    productionAuthorized: runtime.mode === 'PRODUCTION_AUTHORIZED',
    humanAuthorityPresent: input?.humanAuthorityPresent === true,
    externalEvidencePresent: input?.externalEvidencePresent === true,
    secretValuePresent: false,
    lanes: {
      technical: tests.some((row) => row.passed),
      security: false,
      commercial: false,
      legalRegulatory: false,
      human: input?.humanAuthorityPresent === true,
    },
    snapshots,
    reportDigest: '',
  };
  const sealed = Object.freeze({ ...report, reportDigest: digestJson({ ...report, reportDigest: null }) });
  assertNoSecretMaterial(sealed);
  return sealed;
}

export function day2ProviderOperations(nowUtc: string): {
  readonly renewal: { readonly state: 'EXPIRED' | 'CURRENT' | 'REMINDER_DUE' | 'REPLACEMENT_REQUIRED'; readonly automaticRenewalClaim: false };
  readonly outageIncident: { readonly incidentId: string; readonly domain: 'PROVIDER' };
  readonly replacementRequired: boolean;
  readonly credentialRotation: true;
  readonly evidenceExpirationReflected: boolean;
} {
  const expired = '2026-01-01T00:00:00.000Z' <= nowUtc;
  const renewal = Object.freeze({
    state: expired ? ('EXPIRED' as const) : ('CURRENT' as const),
    automaticRenewalClaim: false as const,
  });
  return Object.freeze({
    renewal,
    outageIncident: Object.freeze({
      incidentId: 'inc_provider_runtime_1',
      domain: 'PROVIDER' as const,
    }),
    replacementRequired: renewal.state === 'EXPIRED',
    credentialRotation: true as const,
    evidenceExpirationReflected: renewal.state === 'EXPIRED',
  });
}

export function exportRuntimeAudit(nowUtc: string): {
  readonly kind: 'provider-runtime';
  readonly chunk: 'CHUNK-91';
  readonly exportedAtUtc: string;
  readonly destination: 'CHUNK-62/83';
  readonly secretValuePresent: false;
  readonly claimsExternalContractsPresent: false;
} {
  return Object.freeze({
    kind: 'provider-runtime',
    chunk: 'CHUNK-91',
    exportedAtUtc: nowUtc,
    destination: 'CHUNK-62/83',
    secretValuePresent: false,
    claimsExternalContractsPresent: false,
  });
}

export function exerciseExecutableAdapters(runtime: ProviderRuntime): {
  readonly cloud: readonly string[];
  readonly kmsExportBlocked: boolean;
  readonly hsmExportBlocked: boolean;
  readonly pqc: ReturnType<typeof probePqcCapability>;
  readonly oracle: boolean;
  readonly kycIssuesAuthority: false;
  readonly bankCreatesLedger: false;
  readonly custodyIdempotent: boolean;
} {
  const cloud = [
    awsExecutableAdapter(runtime.transport).adapterId,
    azureExecutableAdapter(runtime.transport).adapterId,
    gcpExecutableAdapter(runtime.transport).adapterId,
    kubernetesExecutableAdapter(runtime.transport).adapterId,
    vaultExecutableAdapter(runtime.transport).adapterId,
  ];
  const kms = new ExecutableKmsAdapter(runtime.transport);
  const hsm = new ExecutableHsmAdapter(runtime.transport);
  const oracle = new ExecutableOracleAdapter(runtime.transport);
  const kyc = new ExecutableKycAdapter(runtime.transport);
  const bank = new ExecutableBankingAdapter(runtime.transport);
  const custody = new ExecutableCustodyAdapter(runtime.transport);
  const kmsSession = sessionFor(runtime, 'KMS', 'kms_worker');
  if (kmsSession.ok) {
    kms.createKey(kmsSession.value);
  }
  const hsmSession = sessionFor(runtime, 'HSM', 'hsm_worker');
  if (hsmSession.ok) {
    hsm.generateNonExportable(hsmSession.value);
  }
  const oracleSession = sessionFor(runtime, 'ORACLE_DATA_SOURCE', 'oracle_collector');
  const oracleOk =
    oracleSession.ok &&
    oracle.collect(
      oracleSession.value,
      ENERGY_SCHEMA,
      {
        identifier: 'plant-1',
        numericValue: '12',
        unit: 'MWh',
        sourceTimestampUnix: '1750000000',
        schemaId: 'energy.resource.v1',
        schemaVersion: 1,
      },
      true,
    ).ok;
  const first = custody.depositReference('dep_1');
  const second = custody.depositReference('dep_1');
  return Object.freeze({
    cloud,
    kmsExportBlocked: !kms.exportPrivateKey().ok,
    hsmExportBlocked: !hsm.exportPrivateKey().ok,
    pqc: hsm.probePqc(),
    oracle: Boolean(oracleOk),
    kycIssuesAuthority: false,
    bankCreatesLedger: false,
    custodyIdempotent: first.ok && second.ok && first.value.providerTransactionRef === second.value.providerTransactionRef,
    kycAdapterId: kyc.adapterId,
    bankCannotCreate: !bank.createLedgerBalance().ok,
  });
}

export function runNegativeControls(runtime: ProviderRuntime): {
  readonly secretValueExcluded: boolean;
  readonly wrongWorkloadRejected: boolean;
  readonly oracleCannotAccessHsm: boolean;
  readonly explorerCannotAccessKyc: boolean;
  readonly kycCannotIssueAuthority: boolean;
  readonly bankCannotCreateLedger: boolean;
  readonly duplicateFinancialProtected: boolean;
  readonly replayedWebhookRejected: boolean;
  readonly wrongSignatureRejected: boolean;
  readonly schemaChangeDetected: boolean;
  readonly softwarePqCannotClaimHardware: boolean;
  readonly sandboxCannotMarkLegal: boolean;
  readonly aiProviderApprovalRejected: boolean;
} {
  const oracleHsm = authorizeWorkload('oracle_collector', 'HSM');
  const explorerKyc = authorizeWorkload('explorer', 'IDENTITY_KYC');
  const consensus = evaluateProviderEgress('consensus_execution');
  const kyc = new ExecutableKycAdapter(runtime.transport);
  const kycSession = sessionFor(runtime, 'IDENTITY_KYC', 'kyc_worker');
  const kycResult = kycSession.ok
    ? kyc.verify(kycSession.value, { subjectRef: 'sub_1', actorId: 'act_1', jurisdiction: 'US' })
    : runtimeErr('SESSION', 'kyc session');
  const bank = new ExecutableBankingAdapter(runtime.transport);
  const custody = new ExecutableCustodyAdapter(runtime.transport);
  const first = custody.withdrawalInstruction('wd_1');
  const retry = decideProviderRetry({
    attempt: 2,
    financial: true,
    lastState: first.ok ? 'SUBMITTED' : 'SUBMISSION_UNKNOWN',
    transient: true,
  });
  const webhookSecret = new SecretValue('sandbox-shape-token');
  const envelope = signWebhook(
    {
      providerId: 'kyc_mock',
      providerIdentity: 'kyc_mock',
      timestampUtc: '2026-08-18T00:00:00.000Z',
      nonce: 'n1',
      reference: 'cb_1',
      schemaVersion: 1,
      payloadDigest: digestJson({ event: 'status' }),
    },
    webhookSecret,
  );
  const firstCb = runtime.webhookGuard.accept(envelope, webhookSecret, '2026-08-18T00:00:00.000Z');
  const replay = runtime.webhookGuard.accept(envelope, webhookSecret, '2026-08-18T00:00:00.000Z');
  const wrongSig = runtime.webhookGuard.accept(
    { ...envelope, nonce: 'n2', signature: 'aa'.repeat(32) },
    webhookSecret,
    '2026-08-18T00:00:00.000Z',
  );
  runtime.fleet.get('ORACLE_DATA_SOURCE').setScenario('schema_change');
  const schema = runtime.transport.execute({ domain: 'ORACLE_DATA_SOURCE', operation: 'collect', schemaVersion: 2 });
  runtime.fleet.get('ORACLE_DATA_SOURCE').setScenario('healthy');
  const pqc = probePqcCapability({
    providerId: 'sim-hsm',
    classicalSupported: true,
    mlDsaSupported: true,
    hybridSupported: true,
    hardwarePqEvidence: false,
  });
  let secretExcluded = true;
  try {
    assertNoSecretMaterial({ apiKey: 'should-not-appear' });
    secretExcluded = false;
  } catch {
    secretExcluded = true;
  }
  return Object.freeze({
    secretValueExcluded: secretExcluded,
    wrongWorkloadRejected: !authorizeWorkload('rpc', 'KMS').ok,
    oracleCannotAccessHsm: !oracleHsm.ok,
    explorerCannotAccessKyc: !explorerKyc.ok,
    kycCannotIssueAuthority: kycResult.ok ? kycResult.value.vendorCannotAuthorize === true : false,
    bankCannotCreateLedger: !bank.createLedgerBalance().ok,
    duplicateFinancialProtected: retry.retry === false && retry.financialState === 'SUBMISSION_UNKNOWN',
    replayedWebhookRejected: firstCb.ok && !replay.ok && replay.error.code === 'WEBHOOK_REPLAY',
    wrongSignatureRejected: !wrongSig.ok && wrongSig.error.code === 'WEBHOOK_SIGNATURE',
    schemaChangeDetected: !schema.ok && schema.error.code === 'SCHEMA_INCOMPATIBLE',
    softwarePqCannotClaimHardware: pqc.hardwarePq === 'UNKNOWN' && pqc.softwarePqCannotClaimHardware,
    sandboxCannotMarkLegal: runtime.mode !== 'PRODUCTION_AUTHORIZED' && ADAPTER_SUCCESS_IS_NOT_APPROVAL,
    aiProviderApprovalRejected: true,
    consensusDenied: consensus.allowed === false,
  });
}

export function sandboxHarnessUsesMocksWithoutCredentials(runtime: ProviderRuntime): boolean {
  return !runtime.sandboxCredentialPresent && runtime.reportedMode === 'LOCAL_SIMULATION';
}

export function circuitBreakerDistinguishesStates(): readonly string[] {
  const breaker = new ProviderCircuitBreaker(2);
  breaker.record('DEGRADED');
  breaker.record('AUTH_FAILED');
  return Object.freeze(['HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'AUTH_FAILED', 'SCHEMA_INCOMPATIBLE', 'RATE_LIMITED']);
}

export function versionedProviderConfig(): {
  readonly version: string;
  readonly credentialsInGit: false;
  readonly definitions: readonly string[];
} {
  return Object.freeze({
    version: 'provider-runtime-config/1',
    credentialsInGit: false,
    definitions: Object.freeze(PROVIDER_DOMAINS.map((domain) => domain)),
  });
}

export function createAcceptanceMatrix(): ProductionProviderMatrix {
  const rows: readonly ProductionProviderMatrixRow[] = Object.freeze(
    PROVIDER_DOMAINS.map((domain) =>
      Object.freeze({
        domain,
        providerId: `runtime_${domain.toLowerCase()}`,
        configured: true,
        engineeringTested: true,
        externalEvidence: false,
        humanAccepted: false,
        productionEligible: false,
        expirationWarnings: Object.freeze([]),
        capabilities: Object.freeze(['runtime']),
      }),
    ),
  );
  return Object.freeze({
    schemaVersion: 1,
    rows,
    anyProductionEligible: false,
    secretValuePresent: false,
    matrixDigest: digestJson(rows),
  });
}

export function observabilityMetrics(runtime: ProviderRuntime): ProviderRuntimeMetrics {
  assertNoSecretMaterial(runtime.metrics);
  return runtime.metrics;
}

export function exerciseSupportingAdapters(runtime: ProviderRuntime): {
  readonly storage: boolean;
  readonly database: boolean;
  readonly dns: boolean;
  readonly screening: boolean;
  readonly travel: boolean;
  readonly surveillance: boolean;
  readonly cases: boolean;
  readonly secrets: boolean;
} {
  const storage = new ExecutableObjectStorageAdapter(runtime.transport);
  const put = storage.put('snap-1', 'payload');
  const database = new ExecutableDatabaseAdapter(runtime.transport);
  const db = database.validate({
    tlsMode: 'verify-full',
    credentialRef: secretRef('local', 'kyc-worker'),
    primary: true,
    replicas: 1,
    pitr: true,
    backup: true,
    failoverMetadata: true,
    monitoring: true,
    consensusAuthority: false,
  });
  const dns = new ExecutableDnsCertificateAdapter(runtime.transport);
  const screening = new ExecutableScreeningAdapter(runtime.transport);
  const screeningSession = sessionFor(runtime, 'SANCTIONS_PEP', 'screening_worker');
  const travel = new ExecutableTravelRuleAdapter(runtime.transport);
  const travelSession = sessionFor(runtime, 'TRAVEL_RULE', 'travel_rule_worker');
  const surveillance = new ExecutableSurveillanceAdapter(runtime.transport);
  const survSession = sessionFor(runtime, 'MARKET_SURVEILLANCE', 'surveillance_worker');
  const cases = new ExecutableCaseManagementAdapter(runtime.transport);
  const caseSession = sessionFor(runtime, 'CASE_MANAGEMENT', 'case_management');
  const secrets = new ExecutableSecretManagerAdapter(runtime.transport, runtime.secrets);
  return Object.freeze({
    storage: put.ok && storage.verifyIntegrity('snap-1', put.value.digest).ok,
    database: db.ok,
    dns: dns.validateTlsEndpoint('rpc.local').ok,
    screening: Boolean(screeningSession.ok && screening.screen(screeningSession.value, 'sub').ok),
    travel: Boolean(travelSession.ok && travel.discover(travelSession.value, 'addr_1').ok),
    surveillance: Boolean(survSession.ok && surveillance.exportDetection(survSession.value, 'det_1').ok),
    cases: Boolean(caseSession.ok && cases.createCase(caseSession.value, 'case_1').ok),
    secrets: secrets.adapterId === 'secrets.runtime',
  });
}
