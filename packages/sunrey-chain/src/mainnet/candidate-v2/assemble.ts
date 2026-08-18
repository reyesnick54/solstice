/**
 * Assemble Production Network Candidate V2 from the canonical stack.
 */

import { PQC_LIBRARY_SELECTION, SUITE_SUNREY_ED25519_V1 } from '../../../../security/src/index.ts';
import { nativeAssetConstitution } from '../../economics/constitution.ts';
import { runEconomicRehearsal } from '../../economic-rehearsal/engine.ts';
import { developmentFeePolicyV2, hashFeePolicyV2 } from '../../fees/v2/policy.ts';
import { commitCanonical } from '../../hash.ts';
import { createLocalHarness } from '../../infra/harness.ts';
import { IAC_MODULES } from '../../infra/config.ts';
import { collectReadinessArtifactDigests } from '../../infra/artifacts.ts';
import { defaultWorkloadIdentities } from '../../infra/identity.ts';
import { parseContainerReference } from '../../infra/services.ts';
import { STORAGE_ENGINE_NAME, STORAGE_SCHEMA_VERSION } from '../../ops/storage.ts';
import { PROTOCOL_CODEC_ID, PROTOCOL_SCHEMA_VERSION } from '../../protocol/constants.ts';
import { developmentPolicyBundle, hashPolicyBundle } from '../../productive/policy-governance/registry.ts';
import {
  createEconomicReleaseCandidate,
  FIRST_ECONOMIC_RC_ID,
  freezeEconomicPolicies,
} from '../../release-candidate/economic/index.ts';
import { resolveSourceCommit } from '../../release-candidate/identity.ts';
import { RELEASE_AUTHORITY_ID } from '../../supply-chain/release.ts';
import { createEconomicPolicy } from '../../validator-economics/policy.ts';
import { sha256File, sha256Text } from '../../supply-chain/inventory.ts';
import { defaultActivationMatrix } from '../capabilities.ts';
import { productionCandidateCryptoPolicy } from '../crypto-policy.ts';
import { emptyAllocationManifest, allocationManifestHash } from '../allocation.ts';
import { consumeFuzzAndAdversarial, consumeFormalAssurance, consumePqc, consumeExternalSecurityReview } from '../consumers.ts';
import { defaultDimensionCatalog } from '../dimensions.ts';
import { sevenProductionCandidateValidators, validatorSetHash } from '../validators.ts';
import {
  CANDIDATE_V2_ADDRESS_HRP,
  CANDIDATE_V2_API_VERSION,
  CANDIDATE_V2_CHAIN_ID,
  CANDIDATE_V2_DISPLAY_NAME,
  CANDIDATE_V2_DOMAIN,
  CANDIDATE_V2_GENESIS_FORMAT_VERSION,
  CANDIDATE_V2_ID,
  CANDIDATE_V2_NETWORK_ID,
  CANDIDATE_V2_PROTOCOL_VERSION,
  CANDIDATE_V2_STATUS,
  assertCandidateV2Identity,
} from './identity.ts';
import { CANDIDATE_V2_TOOL_VERSION, SERVICE_ROLES, type FailureDomainRecord, type ProductionEconomicBundle, type ProductionGenesisInput, type ProductionInfrastructureBundle, type ProductionNetworkCandidateV2, type ProductionNetworkConfiguration, type ProductionNetworkEvidenceBundle, type ProductionNetworkManifestV2, type ProductionProtocolBundle, type ProductionSecurityBundle, type ProductionServiceManifest, type ProductionStorageBundle, type ProductionTopologyManifest, type ProductionValidatorCandidateV2, type ProviderConcentrationReport } from './types.ts';

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const OVERLAY_CHUNKS = new Set(['CHUNK-76', 'CHUNK-77', 'CHUNK-78', 'CHUNK-79', 'CHUNK-80', 'CHUNK-81']);

function digest(label: string, value: unknown): string {
  return commitCanonical({ domain: CANDIDATE_V2_DOMAIN, label, value });
}

function readinessBinding(row: {
  readonly requirementId: string;
  readonly verificationStatus: string;
  readonly evidenceHash: string | null;
  readonly externalEvidence: boolean;
  readonly chunkReference: string | null;
}): string {
  if (row.chunkReference && OVERLAY_CHUNKS.has(row.chunkReference)) {
    return `${row.requirementId}:${row.verificationStatus}:${row.evidenceHash ?? ''}`;
  }
  if (row.externalEvidence) {
    return `${row.requirementId}:${row.verificationStatus}:${row.evidenceHash ? 'PRESENT' : 'NOT_PROVIDED'}`;
  }
  return `${row.requirementId}:${row.verificationStatus}`;
}

function fileDigest(root: string, rel: string): string {
  return sha256File(root, rel) ?? sha256Text(`missing:${rel}`);
}

function failureDomain(index: number, operator: string): FailureDomainRecord {
  return Object.freeze({
    region: `UNKNOWN`,
    availabilityDomain: `sim-domain-${String((index % 3) + 1)}`,
    operator,
    provider: 'LOCAL_INTEGRATION',
    networkZone: index === 0 ? 'VALIDATOR_PRIVATE' : 'SENTRY',
  });
}

function topologyNode(
  nodeId: string,
  role: ProductionTopologyManifest['validators'][number]['role'],
  index: number,
  operator: string,
  notes: string,
) {
  return Object.freeze({
    nodeId,
    role,
    failureDomain: failureDomain(index, operator),
    notes,
  });
}

export function productionCandidateV2Configuration(): ProductionNetworkConfiguration {
  return Object.freeze({
    displayName: CANDIDATE_V2_DISPLAY_NAME,
    networkId: CANDIDATE_V2_NETWORK_ID,
    chainId: CANDIDATE_V2_CHAIN_ID,
    productionAddressHrp: CANDIDATE_V2_ADDRESS_HRP,
    protocolVersion: CANDIDATE_V2_PROTOCOL_VERSION,
    genesisFormatVersion: CANDIDATE_V2_GENESIS_FORMAT_VERSION,
    apiVersion: CANDIDATE_V2_API_VERSION,
    environment: 'simulation',
    mainnetEnabled: false,
    status: CANDIDATE_V2_STATUS,
  });
}

export function buildProtocolBundle(root: string): ProductionProtocolBundle {
  const hashes = {
    transactionEnvelopeHash: fileDigest(root, 'packages/sunrey-chain/src/protocol/envelope.ts'),
    blockFormatHash: fileDigest(root, 'packages/sunrey-chain/rust/crates/types/src/lib.rs'),
    consensusRulesHash: fileDigest(root, 'packages/sunrey-chain/rust/crates/consensus/src/lib.rs'),
    validatorRulesHash: fileDigest(root, 'packages/sunrey-chain/src/validators/index.ts'),
    governanceRulesHash: fileDigest(root, 'packages/sunrey-chain/src/governance/index.ts'),
    executionModulesHash: sha256Text(
      [
        'packages/sunrey-chain/src/native-assets/index.ts',
        'packages/sunrey-chain/src/fees/v2/index.ts',
        'packages/sunrey-chain/src/productive/index.ts',
      ]
        .map((rel) => `${rel}:${fileDigest(root, rel)}`)
        .join('|'),
    ),
    stateSchemaHash: sha256Text(`schema:${PROTOCOL_SCHEMA_VERSION}:${PROTOCOL_CODEC_ID}`),
    feeProtocolHash: fileDigest(root, 'packages/sunrey-chain/src/fees/v2/policy.ts'),
    interopProtocolHash: fileDigest(root, 'packages/sunrey-chain/src/interop/index.ts'),
  };
  return Object.freeze({
    schemaVersion: 1,
    ...hashes,
    interopEnabled: false,
    combinedHash: digest('protocol', hashes),
  });
}

export function buildEconomicBundle(root: string, economicRc: ReturnType<typeof createEconomicReleaseCandidate>): ProductionEconomicBundle {
  const policy = freezeEconomicPolicies(root);
  const fee = developmentFeePolicyV2();
  const moonrey = developmentPolicyBundle();
  const validator = createEconomicPolicy('development', 1);
  const hashes = {
    sunreyMonetaryPolicyHash: policy.hashes.sunreyMonetaryPolicy,
    moonreyMonetaryPolicyHash: policy.hashes.moonreyMonetaryPolicy,
    validatorEconomicsHash: commitCanonical(validator),
    feePolicyV2Hash: hashFeePolicyV2(fee),
    moonreyProductiveIssuanceHash: hashPolicyBundle(moonrey),
    protocolTreasuryHash: policy.hashes.protocolTreasuryPolicy,
    economicGovernanceHash: fileDigest(root, 'packages/sunrey-chain/src/governance-ops/engine.ts'),
    economicRcId: economicRc.bundle.manifest.economic_rc_id,
    economicRcHash: economicRc.bundle.qualification.combinedDigest,
    productionParameters: 'UNCONFIGURED' as const,
    tickerStatus: 'NOT_ASSIGNED' as const,
  };
  return Object.freeze({
    schemaVersion: 1,
    ...hashes,
    combinedHash: digest('economic', hashes),
  });
}

export function buildSecurityBundle(economicStressHash: string): ProductionSecurityBundle {
  const formal = consumeFormalAssurance();
  const fuzz = consumeFuzzAndAdversarial();
  const pqc = consumePqc();
  const audit = consumeExternalSecurityReview();
  const crypto = productionCandidateCryptoPolicy();
  const hashes = {
    cryptoSuiteRegistryHash: commitCanonical({ suite: SUITE_SUNREY_ED25519_V1, pqc: pqc.provider }),
    cryptoPolicyHash: commitCanonical(crypto),
    pqcMigrationPolicyHash: commitCanonical(PQC_LIBRARY_SELECTION),
    rootOfTrustArchitectureHash: fileDigest(process.cwd(), 'packages/security/src/ceremony/types.ts'),
    releaseAuthorityHash: sha256Text(RELEASE_AUTHORITY_ID),
    formalEvidenceHash: formal.reportDigest ?? digest('formal-missing', formal.notes),
    fuzzEvidenceHash: commitCanonical(fuzz),
    adversarialEvidenceHash: commitCanonical({ rangeSchema: fuzz.rangeSchema, invariants: fuzz.invariantCount }),
    economicStressEvidenceHash: economicStressHash,
    auditPreparationEvidenceHash: audit.reviewReference ?? 'NOT_PROVIDED',
    independentAuditCompleted: false as const,
  };
  return Object.freeze({
    schemaVersion: 1,
    ...hashes,
    combinedHash: digest('security', hashes),
  });
}

export function buildInfrastructureBundle(): ProductionInfrastructureBundle {
  const harness = createLocalHarness('PRODUCTION_CANDIDATE');
  const identities = defaultWorkloadIdentities('PRODUCTION_CANDIDATE');
  const hashes = {
    providerRegistryHash: digest('providers', harness.registry.list().map((row) => row.providerId)),
    workloadIdentityHash: digest('identities', identities.list().map((row) => row.service)),
    networkZoneHash: digest('zones', identities.list().map((row) => row.zone)),
    secretReferenceHash: digest('secrets', harness.report.checks.map((row) => row.id)),
    kmsConfigurationHash: digest('kms', { simulation: true }),
    hsmState: 'SIMULATION_HSM' as const,
    tlsConfigurationHash: digest('tls', { local: true }),
    objectStorageHash: digest('object-storage', { adapter: 'local' }),
    containerRegistryHash: digest('registry', { immutableRequired: true }),
    iacHash: digest('iac', IAC_MODULES),
  };
  return Object.freeze({
    schemaVersion: 1,
    ...hashes,
    combinedHash: digest('infrastructure', hashes),
  });
}

export function buildStorageBundle(root: string): ProductionStorageBundle {
  const hashes = {
    redbEngine: STORAGE_ENGINE_NAME,
    redbEngineVersion: '2.4',
    storageSchema: STORAGE_SCHEMA_VERSION,
    snapshotFormatHash: fileDigest(root, 'packages/sunrey-chain/src/ops/snapshots.ts'),
    archivePruningHash: fileDigest(root, 'packages/sunrey-chain/src/ops/storage.ts'),
    postgresProfileHash: fileDigest(root, 'packages/persistence/src/index.ts'),
    backupRecoveryHash: fileDigest(root, 'packages/sunrey-chain/src/ops/backup.ts'),
  };
  return Object.freeze({
    schemaVersion: 1,
    ...hashes,
    combinedHash: digest('storage', hashes),
  });
}

export function sevenCandidateV2Validators(): readonly ProductionValidatorCandidateV2[] {
  return Object.freeze(
    sevenProductionCandidateValidators().map((row, index) =>
      Object.freeze({
        validatorId: row.validatorId.replace('candidate_1', 'candidate_2'),
        operatorReference: row.operatorEntityReference.replace('candidate.1', 'candidate.2'),
        votingPower: row.votingPower.toString(),
        consensusPublicKeyDescriptor: `ed25519:${row.consensusPublicKeyHex}`,
        p2pKeyDescriptor: `ed25519:${row.p2pPublicKeyHex}`,
        governanceKeyDescriptor: `ed25519:${row.governancePublicKeyHex}`,
        signerProvider: 'SIMULATION_SIGNER',
        hsmEvidenceState: 'SIMULATION_HSM' as const,
        failureDomain: failureDomain(index, row.operatorEntityReference.replace('candidate.1', 'candidate.2')),
        bondPolicyReference: 'sunrey.validator.bond.production-candidate.UNCONFIGURED',
        ceremonyState: 'SIMULATION_REHEARSAL' as const,
        operatorEvidenceState: 'PROVIDED_UNVERIFIED' as const,
        productionEligible: false,
        fixtureKey: true,
      }),
    ),
  );
}

export function analyzeConcentration(
  validators: readonly ProductionValidatorCandidateV2[],
  services: ProductionServiceManifest,
): ProviderConcentrationReport {
  const warnings: string[] = [];
  const operators = new Map<string, number>();
  const providers = new Map<string, number>();
  const regions = new Map<string, number>();
  const zones = new Map<string, number>();
  const hsms = new Map<string, number>();
  for (const row of validators) {
    operators.set(row.operatorReference, (operators.get(row.operatorReference) ?? 0) + 1);
    providers.set(row.failureDomain.provider, (providers.get(row.failureDomain.provider) ?? 0) + 1);
    regions.set(row.failureDomain.region, (regions.get(row.failureDomain.region) ?? 0) + 1);
    zones.set(row.failureDomain.networkZone, (zones.get(row.failureDomain.networkZone) ?? 0) + 1);
    hsms.set(row.hsmEvidenceState, (hsms.get(row.hsmEvidenceState) ?? 0) + 1);
  }
  if ([...operators.values()].some((count) => count === validators.length)) {
    warnings.push('all validators share a simulation operator family; IDs differing is not independence');
  }
  if ((providers.get('LOCAL_INTEGRATION') ?? 0) === validators.length) {
    warnings.push('all validators share LOCAL_INTEGRATION; cloud-provider independence is not claimed');
  }
  if ((regions.get('UNKNOWN') ?? 0) === validators.length) {
    warnings.push('all validator regions are UNKNOWN; geographic independence is not claimed');
  }
  if ((hsms.get('SIMULATION_HSM') ?? 0) === validators.length) {
    warnings.push('all validators use SIMULATION_HSM; HSM-provider independence is not claimed');
  }
  void services;
  return Object.freeze({
    operatorConcentration: Object.freeze(warnings.filter((row) => row.includes('operator'))),
    cloudProviderConcentration: Object.freeze(warnings.filter((row) => row.includes('LOCAL_INTEGRATION'))),
    geographicConcentration: Object.freeze(warnings.filter((row) => row.includes('UNKNOWN'))),
    networkConcentration: Object.freeze(
      [...zones.entries()].filter(([, count]) => count * 3 > validators.length).map(([zone]) => `${zone} holds more than one-third of validators`),
    ),
    hsmProviderConcentration: Object.freeze(warnings.filter((row) => row.includes('SIMULATION_HSM'))),
    organizationalIndependenceClaimed: false,
  });
}

export function buildTopology(validators: readonly ProductionValidatorCandidateV2[]): ProductionTopologyManifest {
  const validatorNodes = validators.map((row, index) =>
    topologyNode(row.validatorId, 'validator', index, row.operatorReference, 'candidate validator; fixture keys are not production-eligible'),
  );
  const sentries = validators.map((row, index) =>
    topologyNode(`sentry_${row.validatorId}`, 'sentry', index, row.operatorReference, 'candidate sentry'),
  );
  const rpc = [topologyNode('rpc_candidate_v2_1', 'rpc', 0, 'operator.rpc.unknown', 'candidate RPC')];
  const explorer = [topologyNode('explorer_candidate_v2_1', 'explorer', 1, 'operator.explorer.unknown', 'candidate Explorer')];
  const oracles = [topologyNode('oracle_collector_candidate_v2_1', 'oracle_collector', 2, 'operator.oracle.unknown', 'candidate oracle collector')];
  const monitoring = [topologyNode('monitoring_candidate_v2_1', 'monitoring', 0, 'operator.monitoring.unknown', 'candidate monitoring')];
  const backup = [topologyNode('backup_candidate_v2_1', 'backup', 1, 'operator.backup.unknown', 'candidate backup')];
  const database = [topologyNode('database_candidate_v2_1', 'database', 2, 'operator.database.unknown', 'application PostgreSQL only')];
  const exchange = [topologyNode('exchange_candidate_v2_1', 'exchange', 0, 'operator.exchange.unknown', 'Exchange readiness does not inherit chain readiness')];
  const custody = [topologyNode('custody_candidate_v2_1', 'custody', 1, 'operator.custody.unknown', 'Custody readiness does not inherit Exchange readiness')];
  const relayers = Object.freeze([]) as ProductionTopologyManifest['relayers'];
  const body = {
    validators: Object.freeze(validatorNodes),
    sentries: Object.freeze(sentries),
    rpcNodes: Object.freeze(rpc),
    explorer: Object.freeze(explorer),
    oracleCollectors: Object.freeze(oracles),
    monitoring: Object.freeze(monitoring),
    backupServices: Object.freeze(backup),
    databaseServices: Object.freeze(database),
    exchangeServices: Object.freeze(exchange),
    custodyServices: Object.freeze(custody),
    relayers,
  };
  return Object.freeze({
    schemaVersion: 1,
    candidateId: CANDIDATE_V2_ID,
    ...body,
    combinedHash: digest('topology', body),
  });
}

export function buildServiceManifest(): ProductionServiceManifest {
  const identities = defaultWorkloadIdentities('PRODUCTION_CANDIDATE');
  const services = SERVICE_ROLES.map((role, index) => {
    const digestHex = sha256Text(`sunrey-candidate-v2-artifact|${role}|${CANDIDATE_V2_ID}`);
    const artifact = parseContainerReference({
      name: `sunrey/${role}`,
      digest: `sha256:${digestHex}`,
      tag: `candidate-v2-${digestHex.slice(0, 12)}`,
    });
    if (!artifact.ok || !DIGEST_RE.test(artifact.value.digest)) {
      throw new TypeError(`floating container rejected for ${role}`);
    }
    const identity = identities.list().find((row) => row.service === role || (role === 'database' && row.service === 'backup'));
    return Object.freeze({
      role,
      artifactDigest: artifact.value.digest,
      configurationHash: digest(`service-config:${role}`, { role, index }),
      workloadIdentity: identity?.identityId ?? `wl.${role}.UNKNOWN`,
      networkZone: identity?.zone ?? 'UNKNOWN',
      secretReferences: Object.freeze([`secret:${role}:NOT_PROVIDED`]),
      resourceProfile: 'candidate-v2-simulation',
      healthRequirements: Object.freeze(['process-alive', 'config-hash-match']),
      floatingTag: false as const,
    });
  });
  return Object.freeze({
    schemaVersion: 1,
    services: Object.freeze(services),
    combinedHash: digest('services', services),
  });
}

export function buildGenesisInput(): ProductionGenesisInput {
  const allocation = emptyAllocationManifest();
  const body = {
    networkId: CANDIDATE_V2_NETWORK_ID,
    chainId: CANDIDATE_V2_CHAIN_ID,
    addressHrp: CANDIDATE_V2_ADDRESS_HRP,
    protocolVersion: CANDIDATE_V2_PROTOCOL_VERSION,
    genesisFormatVersion: CANDIDATE_V2_GENESIS_FORMAT_VERSION,
    allocationAuthorized: false as const,
    sunreyGenesisSupply: '0' as const,
    moonreyGenesisSupply: '0' as const,
    tickerStatus: 'NOT_ASSIGNED' as const,
    finalized: false as const,
    activated: false as const,
    allocationHash: allocationManifestHash(allocation),
  };
  return Object.freeze({
    ...body,
    inputHash: digest('genesis-input', body),
  });
}

const candidateCache = new Map<string, ProductionNetworkCandidateV2>();

export function resetProductionNetworkCandidateV2Cache(): void {
  candidateCache.clear();
}

export function createProductionNetworkCandidateV2(root = process.cwd()): ProductionNetworkCandidateV2 {
  assertCandidateV2Identity(CANDIDATE_V2_NETWORK_ID, CANDIDATE_V2_CHAIN_ID);
  const configuration = productionCandidateV2Configuration();
  const sourceCommit = resolveSourceCommit(root);
  const cacheKey = `${root}|${sourceCommit}`;
  const cached = candidateCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const economicRc = createEconomicReleaseCandidate({
    root,
    profile: 'smoke',
    rcId: FIRST_ECONOMIC_RC_ID,
  });
  const rehearsal = runEconomicRehearsal(root);
  const integrated = rehearsal.report.integratedEvidenceHashes;
  if (!integrated) {
    throw new TypeError('Chunk 80 rehearsal must record exact integrated evidence hashes');
  }
  const rehearsalEvidenceHash = digest('chunk80-rehearsal', {
    rehearsalId: rehearsal.report.rehearsalId,
    classification: rehearsal.report.classification,
    genesisHash: rehearsal.report.rehearsalGenesis.genesisHash,
    integrated,
    productionAuthorized: rehearsal.report.productionAuthorized,
  });
  const protocol = buildProtocolBundle(root);
  const economic = buildEconomicBundle(root, economicRc);
  const security = buildSecurityBundle(integrated.chunk76StressReportHash);
  const infrastructure = buildInfrastructureBundle();
  const storage = buildStorageBundle(root);
  const validators = sevenCandidateV2Validators();
  const services = buildServiceManifest();
  const topology = buildTopology(validators);
  const concentration = analyzeConcentration(validators, services);
  const genesisInput = buildGenesisInput();
  const constitution = nativeAssetConstitution();
  if (constitution.tickerStatus !== 'NOT_ASSIGNED') {
    throw new TypeError('invented ticker rejected');
  }
  const artifacts = collectReadinessArtifactDigests(root);
  const evidence: ProductionNetworkEvidenceBundle = Object.freeze({
    schemaVersion: 1,
    chunk76StressReportHash: integrated.chunk76StressReportHash,
    chunk77TreasuryPolicyHash: integrated.chunk77TreasuryPolicyHash,
    chunk77TreasuryFormalHash: integrated.chunk77TreasuryFormalHash,
    chunk77TreasuryStressHash: integrated.chunk77TreasuryStressHash,
    chunk78EconomicRcHash: integrated.chunk78EconomicRcHash,
    chunk79GovernancePackageHash: integrated.chunk79GovernancePackageHash,
    chunk80RehearsalEvidenceHash: rehearsalEvidenceHash,
    formalEvidenceHash: artifacts.formalReportDigest,
    fuzzEvidenceHash: security.fuzzEvidenceHash,
    adversarialEvidenceHash: security.adversarialEvidenceHash,
    auditPreparationHash: artifacts.auditBundleDigest,
    combinedHash: '',
  });
  const evidenceWithHash = Object.freeze({
    ...evidence,
    combinedHash: digest('evidence', { ...evidence, combinedHash: undefined }),
  });
  const overlay = {
    chunk76: integrated.chunk76StressReportHash,
    chunk77: integrated.chunk77TreasuryPolicyHash,
    chunk78: integrated.chunk78EconomicRcHash,
    chunk79: integrated.chunk79GovernancePackageHash,
    chunk80: rehearsalEvidenceHash,
    chunk81: digest('candidate-v2-id', CANDIDATE_V2_ID),
  };
  const catalog = defaultDimensionCatalog(overlay);
  const readinessHash = digest(
    'readiness',
    catalog.map((row) => readinessBinding(row)),
  );
  const manifestBody = {
    candidateId: CANDIDATE_V2_ID,
    configuration,
    sourceCommit,
    releaseArtifactHash: digest('committed-release', {
      sourceCommit,
      packageLock: fileDigest(root, 'package-lock.json'),
      cargoLockRust: fileDigest(root, 'packages/sunrey-chain/rust/Cargo.lock'),
      cargoLockNode: fileDigest(root, 'packages/sunrey-chain/node/Cargo.lock'),
      protocol: protocol.combinedHash,
    }),
    protocolVersion: CANDIDATE_V2_PROTOCOL_VERSION,
    apiVersion: CANDIDATE_V2_API_VERSION,
    economicRcId: economicRc.bundle.manifest.economic_rc_id,
    economicRcHash: economicRc.bundle.qualification.combinedDigest,
    cryptoPolicyHash: security.cryptoPolicyHash,
    validatorSetHash: validatorSetHash(sevenProductionCandidateValidators()),
    economicPoliciesHash: economic.combinedHash,
    governancePolicyHash: economic.economicGovernanceHash,
    storageSchemaHash: storage.combinedHash,
    networkTopologyHash: topology.combinedHash,
    infrastructureConfigurationHash: infrastructure.combinedHash,
    serviceManifestHash: services.combinedHash,
    securityEvidenceHash: security.combinedHash,
    readinessEvidenceHash: readinessHash,
  };
  const manifest: ProductionNetworkManifestV2 = Object.freeze({
    schemaVersion: 1,
    ...manifestBody,
    combinedHash: digest('manifest', manifestBody),
  });
  const capabilities = defaultActivationMatrix();
  if (capabilities.some((row) => row.genesis_enabled || row.runtime_enabled || row.human_authorized)) {
    throw new TypeError('capability inheritance or unauthorized activation is forbidden');
  }
  const configurationDigest = digest('configuration', configuration);
  const candidateRootHash = digest('root', {
    configurationDigest,
    networkManifestDigest: manifest.combinedHash,
    protocolBundleDigest: protocol.combinedHash,
    economicBundleDigest: economic.combinedHash,
    security: security.combinedHash,
    infrastructure: infrastructure.combinedHash,
    storage: storage.combinedHash,
    topology: topology.combinedHash,
    services: services.combinedHash,
    evidence: evidenceWithHash.combinedHash,
    validators: validators.map((row) => row.validatorId),
  });
  const assembled = Object.freeze({
    schemaVersion: 1,
    toolVersion: CANDIDATE_V2_TOOL_VERSION,
    candidateId: CANDIDATE_V2_ID,
    configuration,
    manifest,
    protocol,
    economic,
    security,
    infrastructure,
    storage,
    topology,
    services,
    validators,
    concentration,
    capabilities,
    capabilityInheritance: false,
    genesisInput,
    evidence: evidenceWithHash,
    compatibility: Object.freeze({
      schemaVersion: 1,
      protocolCompatible: true,
      economicRcBound: economic.economicRcId === FIRST_ECONOMIC_RC_ID,
      rehearsalDistinct: true,
      v1Distinct: true,
      sdkCompatible: true,
      explorerCompatible: true,
      notes: Object.freeze([
        'Candidate V2 binds Chunks 65–80 without launching mainnet.',
        'Engineering readiness of SunRey Chain does not imply Exchange eligibility.',
        'Exchange readiness does not imply custody eligibility.',
        'Custody readiness does not imply fiat or payment authorization.',
      ]),
    }),
    configurationDigest,
    networkManifestDigest: manifest.combinedHash,
    protocolBundleDigest: protocol.combinedHash,
    economicBundleDigest: economic.combinedHash,
    candidateRootHash,
    status: 'CANDIDATE',
    mainnetEnabled: false,
    productionAuthorized: false,
    environment: 'simulation',
  });
  candidateCache.set(cacheKey, assembled);
  return assembled;
}
