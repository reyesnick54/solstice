/**
 * Deterministic ProductionEnvironmentPlan.
 *
 * Identical approved inputs produce the same semantic plan hash.
 * Local timestamps are excluded from the hash. Plans contain
 * SecretReference IDs only — never secret values or private keys.
 */

import { secretRef } from '../../../../security/src/secrets.ts';
import { assertNoPrivateKeyMaterial } from '../../../../security/src/crypto-leakage.ts';
import { unwrapSecurity } from '../../../../security/src/errors.ts';
import { CANDIDATE_V2_ID } from '../../mainnet/candidate-v2/identity.ts';
import { createProductionNetworkCandidateV2 } from '../../mainnet/candidate-v2/assemble.ts';
import { verifyProductionNetworkCandidateV2 } from '../../mainnet/candidate-v2/verify.ts';
import {
  consumeAuditEvidence,
  consumeCandidateV2,
  consumeMainnetRc,
  consumeMainnetRcBundle,
  consumeProviderAcceptance,
  mainnetRcCryptographicHash,
} from '../../production-ceremony/bindings.ts';
import { FIRST_MAINNET_RC_ID } from '../../release-candidate/mainnet/types.ts';
import { evaluateNetworkPath } from '../network.ts';
import { digestJson } from '../hash.ts';
import { defaultWorkloadIdentities } from '../identity.ts';
import { parseContainerReference, requireImmutableDigest } from '../services.ts';
import { NETWORK_ZONES, unwrapInfra, type NetworkZone } from '../types.ts';
import { PROVISIONING_PLAN_ID, rejectTestNetworkForProduction, targetForClass } from './identity.ts';
import { gateProvidersForTarget } from './providers.ts';
import {
  OBJECT_STORAGE_PURPOSES,
  PROVISIONING_OPERATION_KINDS,
  PROVISIONING_SERVICE_ROLES,
  type DeploymentAuthorizationPackage,
  type DisasterRecoveryBinding,
  type ProductionEnvironmentClass,
  type ProductionEnvironmentPlan,
  type ProductionEnvironmentVerificationReport,
  type ProvisioningOperation,
  type ProvisioningServiceRole,
  type ServiceDeploymentBinding,
  type ValidatorDeploymentBinding,
} from './types.ts';

const SERVICE_ZONE: Readonly<Record<ProvisioningServiceRole, NetworkZone>> = Object.freeze({
  validator: 'VALIDATOR_PRIVATE',
  sentry: 'SENTRY',
  rpc: 'PUBLIC_RPC',
  explorer: 'PUBLIC_EDGE',
  oracle: 'OPERATIONS_PRIVATE',
  exchange: 'DATA_PRIVATE',
  custody: 'CUSTODY_PRIVATE',
  database: 'DATA_PRIVATE',
  monitoring: 'OBSERVABILITY',
  backup: 'BACKUP',
  release: 'OPERATIONS_PRIVATE',
});

const OPERATION_ORDER: readonly { readonly kind: (typeof PROVISIONING_OPERATION_KINDS)[number]; readonly target: string }[] = [
  { kind: 'NETWORK', target: 'zones' },
  { kind: 'SECURITY_PRIMITIVES', target: 'kms-hsm' },
  { kind: 'STORAGE', target: 'object-and-chain' },
  { kind: 'DATABASE', target: 'postgres' },
  { kind: 'SENTRIES', target: 'sentry' },
  { kind: 'SIGNERS', target: 'remote-signer' },
  { kind: 'VALIDATORS', target: 'validator' },
  { kind: 'RPC', target: 'rpc' },
  { kind: 'EXPLORER', target: 'explorer' },
  { kind: 'MONITORING', target: 'monitoring' },
  { kind: 'BACKUPS', target: 'backup' },
  { kind: 'OFFCHAIN_SERVICES', target: 'oracle-exchange-custody-release' },
];

function artifactDigest(role: string, rcHash: string, candidateHash: string): string {
  const digest = digestJson({ role, rcHash, candidateHash, floating: false });
  return digest;
}

function serviceBinding(
  role: ProvisioningServiceRole,
  rcHash: string,
  candidateHash: string,
  environmentClass: ProductionEnvironmentClass,
): ServiceDeploymentBinding {
  const digest = artifactDigest(role, rcHash, candidateHash);
  return Object.freeze({
    role,
    zone: SERVICE_ZONE[role],
    artifactDigest: digest,
    workloadIdentity: `wid_${environmentClass.toLowerCase()}_${role}`,
    secretReferences: Object.freeze([secretRef('local-infra', `workload/${environmentClass}/${role}`).href]),
    floatingImage: false,
    capabilityActivation: false,
  });
}

export function semanticPlanHash(plan: Omit<ProductionEnvironmentPlan, 'planHash'>): string {
  return digestJson({
    planId: plan.planId,
    environmentClass: plan.environment.class,
    networkId: plan.environment.networkId,
    chainId: plan.environment.chainId,
    candidateV2Id: plan.candidateV2Id,
    candidateV2RootHash: plan.candidateV2RootHash,
    mainnetRcId: plan.mainnetRcId,
    mainnetRcHash: plan.mainnetRcHash,
    providerMatrixDigest: plan.providerMatrixDigest,
    protocolVersion: plan.protocolVersion,
    topologyHash: plan.topologyHash,
    services: plan.services,
    validators: plan.validators,
    operations: plan.operations.map((row) => ({
      operationId: row.operationId,
      kind: row.kind,
      target: row.target,
      zone: row.zone,
      artifactDigest: row.artifactDigest,
      providerId: row.providerId,
      dependsOn: row.dependsOn,
    })),
    artifactDigests: plan.artifactDigests,
    storage: plan.storage,
    objectStorage: plan.objectStorage,
    database: {
      role: plan.database.role,
      replicaCount: plan.database.replicaCount,
      backupEnabled: plan.database.backupEnabled,
      pitrCapable: plan.database.pitrCapable,
      privateNetwork: plan.database.privateNetwork,
      tlsRequired: plan.database.tlsRequired,
      credentialRef: plan.database.credentialRef.href,
    },
    securityPolicy: plan.securityPolicy,
    hsmState: plan.hsmState,
    workloadIdentities: plan.workloadIdentities,
    networkPolicyHash: plan.networkPolicyHash,
    disasterRecovery: plan.disasterRecovery,
    secretReferences: plan.secretReferences,
    genesisExecuted: false,
    customerCapabilitiesActivated: false,
    productionAuthorized: false,
    mainnetEnabled: false,
  });
}

export function createProductionEnvironmentPlan(input: {
  readonly root?: string;
  readonly environmentClass: ProductionEnvironmentClass;
  readonly authorization?: DeploymentAuthorizationPackage;
}): ProductionEnvironmentPlan {
  const root = input.root ?? process.cwd();
  const environment = targetForClass(input.environmentClass);
  rejectTestNetworkForProduction(environment.networkId, input.environmentClass);
  const candidateBinding = consumeCandidateV2(root);
  const rcBinding = consumeMainnetRc(root);
  const rcBundle = consumeMainnetRcBundle(root);
  const candidate = createProductionNetworkCandidateV2(root);
  const candidateReport = verifyProductionNetworkCandidateV2(candidate, root);
  if (!candidateBinding.verified || !candidateReport.ok || candidate.candidateId !== CANDIDATE_V2_ID) {
    throw new TypeError('wrong Candidate V2 rejected');
  }
  if (!rcBinding.verified || rcBundle.manifest.mainnet_rc_id !== FIRST_MAINNET_RC_ID) {
    throw new TypeError('wrong RC rejected');
  }
  if (mainnetRcCryptographicHash(rcBundle) !== rcBinding.hash) {
    throw new TypeError('wrong RC rejected');
  }
  const provider = consumeProviderAcceptance(root);
  const audit = consumeAuditEvidence(root);
  gateProvidersForTarget(input.environmentClass, provider, input.authorization);
  const identities = defaultWorkloadIdentities(
    input.environmentClass === 'PRODUCTION' ? 'PRODUCTION_CANDIDATE' : input.environmentClass === 'MAINNET_REHEARSAL' ? 'MAINNET_REHEARSAL' : input.environmentClass === 'TESTNET' ? 'TESTNET' : 'LOCAL',
  );
  const rcHash = rcBinding.hash!;
  const candidateHash = candidate.candidateRootHash;
  const services = PROVISIONING_SERVICE_ROLES.map((role) => serviceBinding(role, rcHash, candidateHash, input.environmentClass));
  const sentries = candidate.topology.sentries.map((row) => row.nodeId);
  const validators: ValidatorDeploymentBinding[] = candidate.validators.map((row, index) =>
    Object.freeze({
      validatorId: row.validatorId,
      failureDomain: Object.freeze({
        region: row.failureDomain.region,
        availabilityDomain: row.failureDomain.availabilityDomain,
        provider: row.failureDomain.provider,
      }),
      networkZone: 'VALIDATOR_PRIVATE',
      artifactDigest: artifactDigest(`validator:${row.validatorId}`, rcHash, candidateHash),
      storageProfile: `redb:${candidate.storage.redbEngineVersion}`,
      sentryConnections: Object.freeze(sentries.length > 0 ? [sentries[index % sentries.length]!] : ['sentry-local']),
      remoteSignerReference: `signer-ref:${row.signerProvider}:${row.validatorId}`,
      monitoringTarget: `monitor:${row.validatorId}`,
      backupClass: 'CHAIN_STATE',
      workloadIdentity: `wid_${input.environmentClass.toLowerCase()}_validator_${row.validatorId}`,
      privateSigningMaterialEmbedded: false,
    }),
  );
  const operations: ProvisioningOperation[] = OPERATION_ORDER.map((row, index) => {
    const dependsOn = index === 0 ? [] : [OPERATION_ORDER[index - 1]!.kind.toLowerCase()];
    const zone = row.kind === 'VALIDATORS' ? 'VALIDATOR_PRIVATE' : row.kind === 'SIGNERS' ? 'SIGNER_PRIVATE' : row.kind === 'SENTRIES' ? 'SENTRY' : row.kind === 'DATABASE' ? 'DATA_PRIVATE' : row.kind === 'RPC' ? 'PUBLIC_RPC' : 'OPERATIONS_PRIVATE';
    return Object.freeze({
      operationId: row.kind.toLowerCase(),
      kind: row.kind,
      target: row.target,
      zone,
      artifactDigest: artifactDigest(row.kind, rcHash, candidateHash),
      providerId: provider.providerId,
      dependsOn: Object.freeze(dependsOn),
      mutatesInfrastructure: false,
    });
  });
  const artifactDigests = Object.fromEntries(services.map((row) => [row.role, row.artifactDigest]));
  const networkPolicyHash = digestJson({
    zones: NETWORK_ZONES,
    defaultDeny: true,
    publicToSigner: evaluateNetworkPath('PUBLIC_EDGE', 'SIGNER_PRIVATE').allowed,
    validatorToSigner: evaluateNetworkPath('VALIDATOR_PRIVATE', 'SIGNER_PRIVATE').allowed,
  });
  const disasterRecovery: DisasterRecoveryBinding[] = PROVISIONING_SERVICE_ROLES.map((service) =>
    Object.freeze({
      service,
      backupClass: service === 'database' ? 'APPLICATION_DATABASE' : service === 'validator' ? 'CHAIN_STATE' : 'CONFIGURATION',
      recoveryMethod: 'verified-snapshot-restore',
      failureDomain: service,
      recoveryEvidenceLocation: `object://dr/${service}`,
    }),
  );
  const secretReferences = Object.freeze([
    ...services.flatMap((row) => row.secretReferences),
    secretRef('local-infra', 'service/database').href,
  ]);
  const draft = {
    schemaVersion: 1 as const,
    toolVersion: 'sunrey-infra/provisioning/1' as const,
    planId: PROVISIONING_PLAN_ID,
    environment,
    candidateV2Id: candidate.candidateId,
    candidateV2RootHash: candidateHash,
    mainnetRcId: rcBundle.manifest.mainnet_rc_id,
    mainnetRcHash: rcHash,
    providerMatrixDigest: provider.matrix?.matrixDigest ?? 'absent',
    protocolVersion: candidate.configuration.protocolVersion,
    topologyHash: candidate.topology.combinedHash,
    services: Object.freeze(services),
    validators: Object.freeze(validators),
    operations: Object.freeze(operations),
    dependencies: Object.freeze(operations.map((row) => Object.freeze({ operationId: row.operationId, requires: row.dependsOn }))),
    artifactDigests: Object.freeze(artifactDigests),
    storage: Object.freeze({
      engine: 'redb' as const,
      volumeRef: 'volume://chain-redb',
      snapshotLocation: 'object://chain-backups',
      archivePruningPolicy: candidate.storage.archivePruningHash,
      capacityAlert: '80-percent-volume',
      backupPath: 'object://chain-backups/redb',
    }),
    objectStorage: Object.freeze({
      adapter: 'ObjectStorageAdapter' as const,
      purposes: OBJECT_STORAGE_PURPOSES,
    }),
    database: Object.freeze({
      role: 'PRIMARY' as const,
      replicaCount: 1,
      backupEnabled: true as const,
      pitrCapable: true,
      privateNetwork: true as const,
      tlsRequired: true as const,
      credentialRef: secretRef('local-infra', 'service/database'),
      monitoring: true as const,
      authority: 'APPLICATION_ONLY' as const,
    }),
    securityPolicy: `hsm=${rcBundle.hsm.state};audit=${audit.externalReviewStatus}`,
    hsmState: rcBundle.hsm.state,
    workloadIdentities: Object.freeze([
      ...identities.list().map((row) => row.identityId),
      `wid_${input.environmentClass.toLowerCase()}_database`,
    ]),
    networkPolicyHash,
    observability: Object.freeze({
      metrics: true as const,
      logs: true as const,
      traces: input.environmentClass !== 'LOCAL',
      alertRoutes: Object.freeze(['ops-rehearsal']),
      auditEvents: true as const,
      credentialsLogged: false as const,
    }),
    disasterRecovery: Object.freeze(disasterRecovery),
    evidence: Object.freeze([
      { evidenceId: 'candidate-v2', kind: 'CANDIDATE_V2', digest: candidateHash, reference: candidateBinding.source, secretValuePresent: false as const },
      { evidenceId: 'mainnet-rc', kind: 'MAINNET_RC', digest: rcHash, reference: rcBinding.source, secretValuePresent: false as const },
      { evidenceId: 'providers', kind: 'PROVIDER_MATRIX', digest: provider.matrix?.matrixDigest ?? '', reference: 'chunk-82', secretValuePresent: false as const },
      { evidenceId: 'audit', kind: 'AUDIT', digest: rcBundle.audit.digest, reference: 'chunk-83', secretValuePresent: false as const },
    ]),
    secretReferences,
    genesisExecuted: false as const,
    customerCapabilitiesActivated: false as const,
    productionAuthorized: false as const,
    mainnetEnabled: false as const,
  };
  const plan: ProductionEnvironmentPlan = Object.freeze({
    ...draft,
    planHash: semanticPlanHash(draft),
  });
  unwrapSecurity(assertNoPrivateKeyMaterial(plan, 'production-environment-plan'));
  if (plan.secretReferences.some((href) => /secret=|password=|BEGIN /.test(href))) {
    throw new TypeError('secret value present in plan');
  }
  return plan;
}

export function verifyProductionEnvironmentPlan(
  plan: ProductionEnvironmentPlan,
  root = process.cwd(),
): ProductionEnvironmentVerificationReport {
  const candidate = consumeCandidateV2(root);
  const rc = consumeMainnetRc(root);
  const provider = consumeProviderAcceptance(root);
  const recomputed = createProductionEnvironmentPlan({ root, environmentClass: plan.environment.class });
  const floating = Object.values(plan.artifactDigests).some((digest) => digest.startsWith('latest') || digest.includes(':latest'));
  const signerPublic = plan.validators.some((row) => row.networkZone !== 'VALIDATOR_PRIVATE' || row.privateSigningMaterialEmbedded);
  const checks = [
    { id: 'candidate-v2', ok: candidate.verified && candidate.id === plan.candidateV2Id && candidate.hash === plan.candidateV2RootHash, detail: plan.candidateV2Id },
    { id: 'mainnet-rc', ok: rc.verified && rc.id === plan.mainnetRcId && rc.hash === plan.mainnetRcHash, detail: plan.mainnetRcId },
    { id: 'plan-hash', ok: recomputed.planHash === plan.planHash, detail: plan.planHash },
    { id: 'provider-gating', ok: provider.productionEligible === false || plan.environment.class !== 'PRODUCTION', detail: provider.acceptanceStatus },
    { id: 'artifact-immutability', ok: !floating, detail: 'immutable artifact digests' },
    { id: 'network-policy', ok: !evaluateNetworkPath('PUBLIC_EDGE', 'SIGNER_PRIVATE').allowed, detail: 'default deny public→signer' },
    { id: 'secrets-absent', ok: plan.secretReferences.every((href) => href.startsWith('secret://')), detail: 'SecretReference IDs only' },
    { id: 'private-keys-absent', ok: !signerPublic, detail: 'signer references only' },
    { id: 'genesis', ok: plan.genesisExecuted === false, detail: 'genesis is not part of provisioning' },
    { id: 'capabilities', ok: plan.customerCapabilitiesActivated === false, detail: 'customer capabilities remain gated' },
    { id: 'production-flag', ok: plan.productionAuthorized === false && plan.mainnetEnabled === false, detail: 'productionAuthorized=false' },
  ];
  return Object.freeze({
    schemaVersion: 1,
    planHash: plan.planHash,
    candidateV2Verified: checks[0]!.ok,
    mainnetRcVerified: checks[1]!.ok,
    providerGating: checks[3]!.ok,
    artifactImmutability: checks[4]!.ok,
    networkPolicy: checks[5]!.ok,
    secretsAbsent: checks[6]!.ok,
    privateKeysAbsent: checks[7]!.ok,
    genesisExecuted: false,
    productionAuthorized: false,
    mainnetEnabled: false,
    checks: Object.freeze(checks),
    ok: checks.every((row) => row.ok),
  });
}

export function rejectWrongCandidateV2(plan: ProductionEnvironmentPlan, presented: string): void {
  if (presented !== plan.candidateV2RootHash) {
    throw new TypeError('wrong Candidate V2 rejected');
  }
}

export function rejectWrongMainnetRc(plan: ProductionEnvironmentPlan, presented: string): void {
  if (presented !== plan.mainnetRcHash) {
    throw new TypeError('wrong RC rejected');
  }
}

export function rejectFloatingImage(digest: string): void {
  if (digest.includes(':latest') || digest === 'latest' || digest.length === 0) {
    throw new TypeError('floating image rejected');
  }
  const normalized = digest.startsWith('sha256:') ? digest : /^[0-9a-f]{64}$/.test(digest) ? `sha256:${digest}` : digest;
  const parsed = parseContainerReference({
    name: 'sunrey-node',
    digest: normalized,
    tag: null,
  });
  if (!parsed.ok) {
    throw new TypeError('floating image rejected');
  }
  unwrapInfra(requireImmutableDigest(parsed.value));
}

export function rejectPublicSignerExposure(zone: NetworkZone): void {
  if (zone === 'PUBLIC_EDGE' || zone === 'PUBLIC_RPC') {
    throw new TypeError('public signer exposure rejected');
  }
}
