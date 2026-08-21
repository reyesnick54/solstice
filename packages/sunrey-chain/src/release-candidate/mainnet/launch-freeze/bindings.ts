/**
 * Exact-version bindings and immutable snapshots of existing owners.
 * This module references hashes. It does not copy economic parameters
 * or confidential documents into a second source of truth.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  ENVIRONMENT,
  LIVE_BANKING_RAILS,
  LIVE_CRYPTO_ENABLED,
  LIVE_DATA_MARKET_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_EXTERNAL_BANK_CONNECTION,
  LIVE_EXTERNAL_KYC,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
  LIVE_TRADING_ENABLED,
  REAL_MONEY_ENABLED,
} from '../../../../../config/src/flags.ts';
import { sha256File, sha256Text } from '../../../supply-chain/inventory.ts';
import { evaluateCurrentRepositoryAuthorization } from '../../../economics/production-activation/authorization/assemble.ts';
import { parameterStatusesFromPackage } from '../../../economics/production-activation/authorization/classify.ts';
import { currentRepositoryParameterPackage } from '../../../economics/production-activation/parameter-package/validation.ts';
import { evaluateProductionEconomicActivation } from '../../../economics/production-activation/firewall.ts';
import { currentRepositorySnapshot } from '../../../economics/production-activation/fixtures.ts';
import { MONETARY_POLICY_VERSION_ID } from '../../../economics/types.ts';
import { currentRepositoryCandidateBundle as currentEconomicConstitutionBundle } from '../../economic/production-constitution/fixtures.ts';
import { FIRST_ECONOMIC_RC_ID, freezeEconomicPolicies } from '../../economic/index.ts';
import { FIRST_MAINNET_RC_ID } from '../types.ts';
import { resolveMainnetSourceCommit } from '../identity.ts';
import {
  freezeMainnetCrypto,
  freezeMainnetEconomic,
  freezeMainnetProtocol,
  freezeMainnetSource,
  freezeRootOfTrust,
} from '../freeze.ts';
import { buildGenesisCandidate } from '../../../mainnet/genesis-candidate.ts';
import { sevenProductionCandidateValidators, validatorSetHash } from '../../../mainnet/validators.ts';
import {
  PRODUCTION_ADDRESS_HRP,
  PRODUCTION_CANDIDATE_CHAIN_ID,
  PRODUCTION_CANDIDATE_NETWORK_ID,
} from '../../../mainnet/identity.ts';
import { CANDIDATE_V2_ID } from '../../../mainnet/candidate-v2/identity.ts';
import { createProductionCeremonyPlan, planHash } from '../../../production-ceremony/plan.ts';
import {
  ExternalEvidenceRegistry,
  publicSafeView,
  type ExternalEvidenceRegistrySnapshot,
} from '../../../mainnet/external-evidence/index.ts';
import {
  defaultOperatingScopeCatalog,
  defaultProductRows,
  evaluateOperatingScope,
  listCorridors,
  SCOPE_REQUIREMENTS,
} from '../../../mainnet/operating-scope/index.ts';
import { fixtureCatalogBindings } from '../../../providers/production-binding/fixtures.ts';
import { bindingDigest } from '../../../providers/production-binding/hash.ts';
import {
  FULL_PLATFORM_CANDIDATE_BUNDLE_ID,
  FULL_PLATFORM_CANDIDATE_BUNDLE_VERSION,
  FULL_PLATFORM_CANDIDATE_SCHEMA_VERSION,
} from '../../../production-handoff/full-platform-candidate/types.ts';
import { hashCanonical } from '../../../production-handoff/full-platform-candidate/hash.ts';

import { hashCanonicalJson, hashCanonicalText, implicitVersionRejected } from './hash.ts';
import {
  CRITICAL_LAUNCH_FREEZE_COMPONENTS,
  GENESIS_CANDIDATE_BIND_ID,
  LAUNCH_FREEZE_SCHEMA_VERSION,
  type ConfigurationBaseline,
  type CriticalLaunchFreezeComponent,
  type DatabaseMigrationManifest,
  type ExactVersionBinding,
  type ExternalEvidenceFreezeSnapshot,
  type ExternalEvidenceSnapshotRecord,
  type OperatingScopeFreezeSnapshot,
  type OperatingScopeSnapshotRow,
  type ProviderBindingFreezeSnapshot,
  type ProviderBindingSnapshotRow,
} from './types.ts';

const MIGRATION_DATABASES = ['customer', 'ledger', 'evidence', 'security', 'explorer'] as const;

export function bindExactVersion(input: {
  readonly componentId: string;
  readonly schemaVersion: string;
  readonly contentVersion: string;
  readonly contentHash: string;
}): ExactVersionBinding {
  if (implicitVersionRejected(input.contentVersion) || implicitVersionRejected(input.schemaVersion)) {
    throw new TypeError(`floating version rejected: ${input.componentId}:${input.contentVersion}`);
  }
  if (input.contentVersion.trim().length === 0 || input.schemaVersion.trim().length === 0) {
    throw new TypeError(`unversioned component rejected: ${input.componentId}`);
  }
  if (input.contentHash.trim().length === 0) {
    throw new TypeError(`missing content hash rejected: ${input.componentId}`);
  }
  return Object.freeze({
    componentId: input.componentId,
    schemaVersion: input.schemaVersion,
    contentVersion: input.contentVersion,
    contentHash: input.contentHash,
  });
}

export function rejectFloatingComponentVersions(bindings: readonly ExactVersionBinding[]): readonly string[] {
  return Object.freeze(
    bindings
      .filter(
        (row) =>
          implicitVersionRejected(row.contentVersion) ||
          implicitVersionRejected(row.schemaVersion) ||
          implicitVersionRejected(row.componentId),
      )
      .map((row) => `${row.componentId}:${row.contentVersion}`),
  );
}

export function allCriticalVersionsExplicit(bindings: readonly ExactVersionBinding[]): boolean {
  const byId = new Set(bindings.map((row) => row.componentId));
  return CRITICAL_LAUNCH_FREEZE_COMPONENTS.every((componentId) => {
    const row = bindings.find((item) => item.componentId === componentId);
    return (
      byId.has(componentId) &&
      row !== undefined &&
      row.contentVersion.trim().length > 0 &&
      row.schemaVersion.trim().length > 0 &&
      row.contentHash.trim().length > 0 &&
      !implicitVersionRejected(row.contentVersion)
    );
  });
}

export function resolveSourceTreeHash(root: string): string | null {
  const git = spawnSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root, encoding: 'utf8' });
  if (git.status === 0 && git.stdout.trim().length > 0) {
    return git.stdout.trim();
  }
  return null;
}

export function hashArchitectureManifest(root: string): string {
  return sha256File(root, 'docs/architecture/manifest.json') ?? hashCanonicalText('missing:docs/architecture/manifest.json');
}

export function hashArchitectureIntegrityBaseline(root: string): string {
  const parts = [
    'docs/architecture/manifest.json',
    'docs/architecture/constitution.md',
    'docs/architecture/chunk-dependencies.md',
    'scripts/check-merge-integrity.mjs',
    'scripts/check-json-integrity.mjs',
  ].map((rel) => `${rel}:${sha256File(root, rel) ?? `missing:${rel}`}`);
  return sha256Text(parts.join('\n'));
}

export function hashPackageLock(root: string): string {
  return sha256File(root, 'package-lock.json') ?? hashCanonicalText('missing:package-lock.json');
}

export function hashRustBuildIdentity(root: string): string {
  const parts = [
    'packages/sunrey-chain/supply-chain/toolchain-pins.json',
    'packages/sunrey-chain/rust/rust-toolchain.toml',
    'packages/sunrey-chain/rust/Cargo.lock',
    'packages/sunrey-chain/node/rust-toolchain.toml',
    'packages/sunrey-chain/node/Cargo.lock',
  ].map((rel) => `${rel}:${sha256File(root, rel) ?? `missing:${rel}`}`);
  return sha256Text(parts.join('\n'));
}

export function snapshotExternalEvidence(
  registry: ExternalEvidenceRegistry | ExternalEvidenceRegistrySnapshot,
  nowUtc: string,
): ExternalEvidenceFreezeSnapshot {
  const snapshot =
    registry instanceof ExternalEvidenceRegistry ? registry.snapshot(nowUtc) : registry;
  const records = snapshot.records;
  const safe: readonly ExternalEvidenceSnapshotRecord[] = Object.freeze(
    records.map((record) => {
      const view = publicSafeView(record, nowUtc);
      return Object.freeze({
        recordId: view.recordId,
        evidenceClass: view.evidenceClass,
        subjectType: view.subjectType,
        subjectId: view.subjectId,
        scopeLabel: view.scopeLabel,
        contentDigest: view.contentDigest,
        verificationState: view.verificationState,
        expiresAtUtc: view.expiresAtUtc,
        revoked: view.revoked,
        fixture: view.fixture,
      });
    }),
  );
  const expired = safe.some(
    (row) => row.expiresAtUtc !== null && nowUtc > row.expiresAtUtc && !row.revoked,
  );
  const revoked = safe.some((row) => row.revoked);
  const fixtureOnly = safe.length > 0 && safe.every((row) => row.fixture);
  const complete =
    safe.length > 0 &&
    safe.every((row) => !row.fixture && !row.revoked && row.verificationState === 'VERIFIED_EXTERNAL') &&
    !expired;
  const snapshotHash = hashCanonicalJson({
    domain: 'SUNREY_LAUNCH_FREEZE_EXTERNAL_EVIDENCE_SNAPSHOT_V1',
    records: safe,
  });
  return Object.freeze({
    schemaVersion: LAUNCH_FREEZE_SCHEMA_VERSION,
    contentVersion: 'chunk-160.registry.v1',
    snapshotHash,
    records: safe,
    complete,
    fixtureOnly,
    expired,
    revoked,
  });
}

export function emptyExternalEvidenceSnapshot(): ExternalEvidenceFreezeSnapshot {
  return snapshotExternalEvidence(new ExternalEvidenceRegistry(), '2026-08-21T00:00:00.000Z');
}

export function snapshotOperatingScope(
  catalog = defaultOperatingScopeCatalog(),
  nowUtc = '2026-08-21T00:00:00.000Z',
): OperatingScopeFreezeSnapshot {
  const products = catalog.products.length > 0 ? catalog.products : defaultProductRows();
  const rows: readonly OperatingScopeSnapshotRow[] = Object.freeze(
    products.map((product) => {
      const evaluation = evaluateOperatingScope(
        {
          jurisdiction: product.key.jurisdiction,
          activationDomain: product.key.activationDomain,
          legalEntityRef: product.key.legalEntityRef,
          nowUtc,
          ...(product.key.corridorId ? { corridorId: product.key.corridorId } : {}),
          ...(product.key.asset ? { asset: product.key.asset } : {}),
        },
        catalog,
      );
      return Object.freeze({
        rowId: product.rowId,
        jurisdiction: product.key.jurisdiction,
        legalEntityRef: product.key.legalEntityRef,
        activationDomain: product.key.activationDomain,
        corridorId: product.key.corridorId ?? null,
        asset: product.key.asset ?? null,
        eligibility: evaluation.eligible,
        status: evaluation.status,
        providerRequirements: Object.freeze([...(product.key.providerDependencies ?? [])]),
      });
    }),
  );
  const corridors = catalog.corridors.length > 0 ? catalog.corridors : listCorridors();
  const requirements = catalog.requirements.length > 0 ? catalog.requirements : SCOPE_REQUIREMENTS;
  const snapshotHash = hashCanonicalJson({
    domain: 'SUNREY_LAUNCH_FREEZE_OPERATING_SCOPE_SNAPSHOT_V1',
    rows,
    corridors: corridors.map((row) => row.corridorId),
    requirements: requirements.map((row) => row.requirementId ?? row.evidenceClass),
    providers: catalog.providers.map((row) => `${row.providerRef}:${row.kind}`),
  });
  return Object.freeze({
    schemaVersion: LAUNCH_FREEZE_SCHEMA_VERSION,
    contentVersion: 'chunk-161.operating-scope.v1',
    snapshotHash,
    rows,
    corridorIds: Object.freeze(corridors.map((row) => row.corridorId)),
    requirementIds: Object.freeze(requirements.map((row) => String(row.requirementId ?? row.evidenceClass))),
  });
}

export function snapshotProviderBindings(
  bindings = fixtureCatalogBindings(),
): ProviderBindingFreezeSnapshot {
  const rows: readonly ProviderBindingSnapshotRow[] = Object.freeze(
    bindings.map((binding) =>
      Object.freeze({
        providerId: binding.providerId,
        domain: binding.providerDomain,
        profileVersion: binding.providerProfileVersion,
        endpointProfileHash: bindingDigest({
          endpointProfileRef: binding.endpointProfileRef,
          versionPins: binding.versionPins,
        }),
        credentialDescriptorRef: binding.credentialDescriptorRef,
        evidenceRefs: Object.freeze([...binding.externalEvidenceRefs]),
        operatingScopeRefs: Object.freeze([...binding.operatingScopeRefs]),
        failoverBindingId: binding.failoverBindingId,
      }),
    ),
  );
  return Object.freeze({
    schemaVersion: LAUNCH_FREEZE_SCHEMA_VERSION,
    contentVersion: 'chunk-162.provider-binding.v1',
    snapshotHash: hashCanonicalJson({
      domain: 'SUNREY_LAUNCH_FREEZE_PROVIDER_BINDING_SNAPSHOT_V1',
      rows,
    }),
    rows,
  });
}

export function snapshotDatabaseMigrations(root: string): DatabaseMigrationManifest {
  const databases = Object.freeze(
    MIGRATION_DATABASES.map((databaseName) => {
      const dir = join(root, 'db', databaseName, 'migrations');
      let files: string[] = [];
      try {
        files = readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
      } catch {
        files = [];
      }
      const migrations = Object.freeze(
        files.map((file) =>
          Object.freeze({
            migrationId: file.replace(/\.sql$/, ''),
            contentDigest: sha256File(root, `db/${databaseName}/migrations/${file}`) ?? hashCanonicalText(`missing:${file}`),
          }),
        ),
      );
      return Object.freeze({
        databaseName,
        latestSchemaVersion: migrations.at(-1)?.migrationId ?? 'NONE',
        migrations,
      });
    }),
  );
  return Object.freeze({
    schemaVersion: LAUNCH_FREEZE_SCHEMA_VERSION,
    contentVersion: 'db.migrations.v1',
    manifestHash: hashCanonicalJson({
      domain: 'SUNREY_LAUNCH_FREEZE_MIGRATION_MANIFEST_V1',
      databases,
    }),
    databases,
  });
}

export function snapshotConfigurationBaseline(
  credentialDescriptorRefs: readonly string[],
  rustBuildIdentityHash: string,
): ConfigurationBaseline {
  const liveFlags = Object.freeze({
    LIVE_MONEY_ENABLED,
    LIVE_PAYMENTS_ENABLED,
    LIVE_BANKING_RAILS,
    LIVE_EXTERNAL_KYC,
    LIVE_EXTERNAL_BANK_CONNECTION,
    REAL_MONEY_ENABLED,
    LIVE_TRADING_ENABLED,
    LIVE_CRYPTO_ENABLED,
    LIVE_EXCHANGE_ENABLED,
    LIVE_DATA_MARKET_ENABLED,
    LIVE_INVESTMENT_EXECUTION,
  });
  const credentialDescriptorHashes = Object.freeze(
    credentialDescriptorRefs.map((ref) => hashCanonicalText(`credential-descriptor:${ref}`)),
  );
  return Object.freeze({
    schemaVersion: LAUNCH_FREEZE_SCHEMA_VERSION,
    contentVersion: 'config.simulation.v1',
    baselineHash: hashCanonicalJson({
      domain: 'SUNREY_LAUNCH_FREEZE_CONFIGURATION_BASELINE_V1',
      environment: ENVIRONMENT,
      liveFlags,
      credentialDescriptorHashes,
      rustBuildIdentityHash,
    }),
    environment: 'simulation',
    liveFlags,
    credentialDescriptorHashes,
    rustBuildIdentityHash,
  });
}

export type CurrentRepositoryLaunchBindings = {
  readonly sourceCommit: string;
  readonly sourceTreeHash: string | null;
  readonly architectureManifestHash: string;
  readonly architectureIntegrityBaselineHash: string;
  readonly packageLockHash: string;
  readonly mainnetRcId: string;
  readonly mainnetRcHash: string;
  readonly economicRcId: string;
  readonly economicRcHash: string;
  readonly fullPlatformCandidateHash: string;
  readonly productionEconomicAuthorizationHash: string;
  readonly productionParameterPackageHash: string;
  readonly validatorCandidateSetHash: string;
  readonly cryptographicPolicyHash: string;
  readonly genesisCandidateId: string;
  readonly genesisCandidateHash: string;
  readonly genesisAllocationManifestHash: string;
  readonly productionCeremonyPlanHash: string;
  readonly sbomHash: string;
  readonly provenanceHash: string;
  readonly auditBundleHash: string;
  readonly testReceiptBundleHash: string;
  readonly adversarialCampaignHash: string;
  readonly burnInReportHash: string;
  readonly evidence: ExternalEvidenceFreezeSnapshot;
  readonly operatingScope: OperatingScopeFreezeSnapshot;
  readonly providers: ProviderBindingFreezeSnapshot;
  readonly migrations: DatabaseMigrationManifest;
  readonly configuration: ConfigurationBaseline;
  readonly bindings: readonly ExactVersionBinding[];
  readonly productionParametersComplete: boolean;
  readonly externalEvidenceComplete: boolean;
  readonly humanAuthorizationComplete: boolean;
  readonly engineeringValidated: boolean;
  readonly fixtureEvidenceUsed: boolean;
  readonly unconfiguredTokenomics: readonly string[];
};

export function collectCurrentRepositoryLaunchBindings(
  root = process.cwd(),
  options: {
    readonly sourceCommit?: string;
    readonly nowUtc?: string;
    readonly evidenceRegistry?: ExternalEvidenceRegistry;
  } = {},
): CurrentRepositoryLaunchBindings {
  const sourceCommit = resolveMainnetSourceCommit(root, options.sourceCommit);
  const nowUtc = options.nowUtc ?? '2026-08-21T00:00:00.000Z';
  const architectureManifestHash = hashArchitectureManifest(root);
  const architectureIntegrityBaselineHash = hashArchitectureIntegrityBaseline(root);
  const packageLockHash = hashPackageLock(root);
  const rustBuildIdentityHash = hashRustBuildIdentity(root);
  const economic = freezeMainnetEconomic(root);
  const protocol = freezeMainnetProtocol(root);
  const source = freezeMainnetSource(root, sourceCommit, 'unsigned.engineering.candidate.v1');
  const crypto = freezeMainnetCrypto();
  const rootOfTrust = freezeRootOfTrust();
  const economicPolicies = freezeEconomicPolicies(root);
  const genesis = buildGenesisCandidate();
  const validators = sevenProductionCandidateValidators();
  const validatorCandidateSetHash = validatorSetHash(validators);
  const authorization = evaluateCurrentRepositoryAuthorization();
  const parameters = currentRepositoryParameterPackage();
  const parameterStatuses = parameterStatusesFromPackage(parameters);
  const firewall = evaluateProductionEconomicActivation(currentRepositorySnapshot());
  const constitution = currentEconomicConstitutionBundle(firewall.decisionId, root);
  const evidence = options.evidenceRegistry
    ? snapshotExternalEvidence(options.evidenceRegistry, nowUtc)
    : emptyExternalEvidenceSnapshot();
  const operatingScope = snapshotOperatingScope(defaultOperatingScopeCatalog(), nowUtc);
  const providers = snapshotProviderBindings();
  const migrations = snapshotDatabaseMigrations(root);
  const configuration = snapshotConfigurationBaseline(
    providers.rows.map((row) => row.credentialDescriptorRef),
    rustBuildIdentityHash,
  );
  const mainnetRcHash = hashCanonicalJson({
    rcId: FIRST_MAINNET_RC_ID,
    economic: economic.combinedHash,
    protocol: protocol.combinedHash,
    source: source.combinedDigest,
  });
  const fullPlatformCandidateHash = hashCanonical({
    bundleId: FULL_PLATFORM_CANDIDATE_BUNDLE_ID,
    bundleVersion: FULL_PLATFORM_CANDIDATE_BUNDLE_VERSION,
    schemaVersion: FULL_PLATFORM_CANDIDATE_SCHEMA_VERSION,
    economicConstitutionHash: constitution.bundleHash,
    firewallDecisionHash: firewall.decisionId,
    architectureIntegrityHash: architectureIntegrityBaselineHash,
  });
  const ceremony = createProductionCeremonyPlan({
    mainnetRcId: FIRST_MAINNET_RC_ID,
    mainnetRcHash,
    candidateV2Id: CANDIDATE_V2_ID,
    candidateV2RootHash: genesis.genesisHash,
    economicBundleHash: economicPolicies.combinedHash,
    cryptoPolicyHash: crypto.digest,
    validatorCandidateSetHash,
    networkId: PRODUCTION_CANDIDATE_NETWORK_ID,
    chainId: PRODUCTION_CANDIDATE_CHAIN_ID,
    addressHrp: PRODUCTION_ADDRESS_HRP,
    allocationManifestHash: genesis.allocationHash,
  });
  const testReceiptBundleHash = hashCanonicalText('test-receipt-bundle:engineering.unconfigured.v1');
  const adversarialCampaignHash = hashCanonicalText('adversarial-campaign:not-run.v1');
  const burnInReportHash = hashCanonicalText('burn-in-report:not-run.v1');
  const chunk71Hash = sha256File(root, 'packages/sunrey-chain/src/economics/types.ts') ?? hashCanonicalText(MONETARY_POLICY_VERSION_ID);
  const sunreyPolicyHash = sha256File(root, 'packages/sunrey-chain/src/economics/production-activation/sunrey-package/types.ts') ?? authorization.pkg.sunreyPolicyHash;
  const moonreyPolicyHash =
    sha256File(
      root,
      'packages/sunrey-chain/src/productive/policy-governance/value-function/production-candidate/types.ts',
    ) ?? authorization.pkg.moonreyPolicyHash;
  const version = `v1:${sourceCommit.slice(0, 12)}`;
  const bindingMap: Record<CriticalLaunchFreezeComponent, ExactVersionBinding> = {
    'architecture-manifest': bindExactVersion({
      componentId: 'architecture-manifest',
      schemaVersion: '1',
      contentVersion: version,
      contentHash: architectureManifestHash,
    }),
    'architecture-integrity-baseline': bindExactVersion({
      componentId: 'architecture-integrity-baseline',
      schemaVersion: '1',
      contentVersion: version,
      contentHash: architectureIntegrityBaselineHash,
    }),
    'package-lock': bindExactVersion({
      componentId: 'package-lock',
      schemaVersion: '1',
      contentVersion: version,
      contentHash: packageLockHash,
    }),
    'mainnet-rc': bindExactVersion({
      componentId: 'mainnet-rc',
      schemaVersion: '1',
      contentVersion: FIRST_MAINNET_RC_ID,
      contentHash: mainnetRcHash,
    }),
    'economic-rc': bindExactVersion({
      componentId: 'economic-rc',
      schemaVersion: '1',
      contentVersion: FIRST_ECONOMIC_RC_ID,
      contentHash: economic.economicRcHash,
    }),
    'full-platform-candidate': bindExactVersion({
      componentId: 'full-platform-candidate',
      schemaVersion: String(FULL_PLATFORM_CANDIDATE_SCHEMA_VERSION),
      contentVersion: FULL_PLATFORM_CANDIDATE_BUNDLE_VERSION,
      contentHash: fullPlatformCandidateHash,
    }),
    'production-economic-authorization': bindExactVersion({
      componentId: 'production-economic-authorization',
      schemaVersion: '1',
      contentVersion: authorization.pkg.packageId,
      contentHash: authorization.pkg.authorizationHash,
    }),
    'production-parameter-package': bindExactVersion({
      componentId: 'production-parameter-package',
      schemaVersion: String(parameters.schemaVersion),
      contentVersion: parameters.packageVersion,
      contentHash: parameters.packageHash,
    }),
    'chunk-71-monetary-constitution': bindExactVersion({
      componentId: 'chunk-71-monetary-constitution',
      schemaVersion: '1',
      contentVersion: MONETARY_POLICY_VERSION_ID,
      contentHash: chunk71Hash,
    }),
    'chunk-144-parameter-package': bindExactVersion({
      componentId: 'chunk-144-parameter-package',
      schemaVersion: String(parameters.schemaVersion),
      contentVersion: parameters.packageVersion,
      contentHash: parameters.packageHash,
    }),
    'chunk-145-sunrey-policy-candidate': bindExactVersion({
      componentId: 'chunk-145-sunrey-policy-candidate',
      schemaVersion: '1',
      contentVersion: 'sunrey-production-issuance-policy-candidate.v1',
      contentHash: sunreyPolicyHash,
    }),
    'chunk-146-moonrey-policy-candidate': bindExactVersion({
      componentId: 'chunk-146-moonrey-policy-candidate',
      schemaVersion: '1',
      contentVersion: 'moonrey-production-issuance-policy-candidate.v1',
      contentHash: moonreyPolicyHash,
    }),
    'chunk-148-economic-constitution-candidate': bindExactVersion({
      componentId: 'chunk-148-economic-constitution-candidate',
      schemaVersion: '1',
      contentVersion: constitution.bundleId,
      contentHash: constitution.bundleHash,
    }),
    'chunk-163-economic-authorization': bindExactVersion({
      componentId: 'chunk-163-economic-authorization',
      schemaVersion: '1',
      contentVersion: authorization.pkg.packageId,
      contentHash: authorization.pkg.authorizationHash,
    }),
    'external-evidence-snapshot': bindExactVersion({
      componentId: 'external-evidence-snapshot',
      schemaVersion: '1',
      contentVersion: evidence.contentVersion,
      contentHash: evidence.snapshotHash,
    }),
    'operating-scope-snapshot': bindExactVersion({
      componentId: 'operating-scope-snapshot',
      schemaVersion: '1',
      contentVersion: operatingScope.contentVersion,
      contentHash: operatingScope.snapshotHash,
    }),
    'provider-binding-snapshot': bindExactVersion({
      componentId: 'provider-binding-snapshot',
      schemaVersion: '1',
      contentVersion: providers.contentVersion,
      contentHash: providers.snapshotHash,
    }),
    'validator-candidate-set': bindExactVersion({
      componentId: 'validator-candidate-set',
      schemaVersion: '1',
      contentVersion: 'seven-production-candidate-validators.v1',
      contentHash: validatorCandidateSetHash,
    }),
    'cryptographic-policy': bindExactVersion({
      componentId: 'cryptographic-policy',
      schemaVersion: '1',
      contentVersion: crypto.policyId,
      contentHash: crypto.digest,
    }),
    'genesis-candidate': bindExactVersion({
      componentId: 'genesis-candidate',
      schemaVersion: '1',
      contentVersion: GENESIS_CANDIDATE_BIND_ID,
      contentHash: genesis.genesisHash,
    }),
    'genesis-allocation-manifest': bindExactVersion({
      componentId: 'genesis-allocation-manifest',
      schemaVersion: '1',
      contentVersion: 'genesis-allocation.unauthorized.v1',
      contentHash: genesis.allocationHash,
    }),
    'production-ceremony-plan': bindExactVersion({
      componentId: 'production-ceremony-plan',
      schemaVersion: '1',
      contentVersion: ceremony.planId,
      contentHash: planHash(ceremony),
    }),
    'database-migration-manifest': bindExactVersion({
      componentId: 'database-migration-manifest',
      schemaVersion: '1',
      contentVersion: migrations.contentVersion,
      contentHash: migrations.manifestHash,
    }),
    'configuration-baseline': bindExactVersion({
      componentId: 'configuration-baseline',
      schemaVersion: '1',
      contentVersion: configuration.contentVersion,
      contentHash: configuration.baselineHash,
    }),
    sbom: bindExactVersion({
      componentId: 'sbom',
      schemaVersion: '1',
      contentVersion: 'sbom.engineering.v1',
      contentHash: source.sbomDigest,
    }),
    provenance: bindExactVersion({
      componentId: 'provenance',
      schemaVersion: '1',
      contentVersion: 'provenance.engineering.v1',
      contentHash: source.provenanceDigest,
    }),
    'audit-bundle': bindExactVersion({
      componentId: 'audit-bundle',
      schemaVersion: '1',
      contentVersion: 'audit.engineering-preparation.v1',
      contentHash: rootOfTrust.digest,
    }),
    'test-receipt-bundle': bindExactVersion({
      componentId: 'test-receipt-bundle',
      schemaVersion: '1',
      contentVersion: 'test-receipt.engineering.unconfigured.v1',
      contentHash: testReceiptBundleHash,
    }),
    'adversarial-campaign': bindExactVersion({
      componentId: 'adversarial-campaign',
      schemaVersion: '1',
      contentVersion: 'adversarial.not-run.v1',
      contentHash: adversarialCampaignHash,
    }),
    'burn-in-report': bindExactVersion({
      componentId: 'burn-in-report',
      schemaVersion: '1',
      contentVersion: 'burn-in.not-run.v1',
      contentHash: burnInReportHash,
    }),
  };
  const unconfiguredTokenomics = parameterStatuses
    .filter((row) => !row.productionEligible)
    .map((row) => row.parameterId);
  return Object.freeze({
    sourceCommit,
    sourceTreeHash: resolveSourceTreeHash(root),
    architectureManifestHash,
    architectureIntegrityBaselineHash,
    packageLockHash,
    mainnetRcId: FIRST_MAINNET_RC_ID,
    mainnetRcHash,
    economicRcId: FIRST_ECONOMIC_RC_ID,
    economicRcHash: economic.economicRcHash,
    fullPlatformCandidateHash,
    productionEconomicAuthorizationHash: authorization.pkg.authorizationHash,
    productionParameterPackageHash: parameters.packageHash,
    validatorCandidateSetHash,
    cryptographicPolicyHash: crypto.digest,
    genesisCandidateId: GENESIS_CANDIDATE_BIND_ID,
    genesisCandidateHash: genesis.genesisHash,
    genesisAllocationManifestHash: genesis.allocationHash,
    productionCeremonyPlanHash: planHash(ceremony),
    sbomHash: source.sbomDigest,
    provenanceHash: source.provenanceDigest,
    auditBundleHash: rootOfTrust.digest,
    testReceiptBundleHash,
    adversarialCampaignHash,
    burnInReportHash,
    evidence,
    operatingScope,
    providers,
    migrations,
    configuration,
    bindings: Object.freeze(CRITICAL_LAUNCH_FREEZE_COMPONENTS.map((id) => bindingMap[id])),
    productionParametersComplete: unconfiguredTokenomics.length === 0,
    externalEvidenceComplete: evidence.complete,
    humanAuthorizationComplete: false,
    engineeringValidated: true,
    fixtureEvidenceUsed: evidence.fixtureOnly,
    unconfiguredTokenomics: Object.freeze(unconfiguredTokenomics),
  });
}
