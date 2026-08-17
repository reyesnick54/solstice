/**
 * Chunk 59 — SunRey software supply-chain types.
 *
 * ReleaseAuthority signs artifacts only. It is not Execution Authority,
 * validator governance, a custody signer, or a wallet signer. Software
 * release approval does not activate protocol change.
 */

export const POLICY_CLASSIFICATIONS = [
  'APPROVED',
  'REVIEW_REQUIRED',
  'TEMPORARY_EXCEPTION',
  'BLOCKED',
] as const;
export type PolicyClassification = (typeof POLICY_CLASSIFICATIONS)[number];

export const DEPENDENCY_ROLES = ['runtime', 'build', 'dev'] as const;
export type DependencyRole = (typeof DEPENDENCY_ROLES)[number];

export const CRITICALITY_ROLES = [
  'cryptography',
  'consensus',
  'serialization',
  'p2p',
  'storage',
  'wallet-signing',
  'hsm-kms',
  'interop-proofs',
] as const;
export type CriticalityRole = (typeof CRITICALITY_ROLES)[number];

export const CRYPTO_PRIMITIVES = ['signature', 'hash', 'KDF', 'AEAD', 'KEM', 'PQC'] as const;
export type CryptoPrimitive = (typeof CRYPTO_PRIMITIVES)[number];

export const AUDIT_KINDS = [
  'known_advisory',
  'unmaintained_warning',
  'license_issue',
  'yanked_dependency',
  'duplicate_risk_warning',
  'unregistered_crypto',
  'unlocked_dependency',
  'blocked_package',
  'tampered_artifact',
] as const;
export type AuditKind = (typeof AUDIT_KINDS)[number];

export const RELEASE_STATUSES = ['ACTIVE', 'SUPERSEDED', 'REVOKED'] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const REPRO_STATUSES = ['MATCHED', 'NOT_REPRODUCED', 'NOT_ATTEMPTED'] as const;
export type ReproStatus = (typeof REPRO_STATUSES)[number];

export type SoftwareComponent = {
  readonly name: string;
  readonly version: string;
  readonly source: string;
  readonly integrity: string | null;
  readonly license: string;
  readonly direct: boolean;
  readonly role: DependencyRole;
  readonly ecosystem: 'npm' | 'crates.io' | 'container' | 'github-actions' | 'toolchain' | 'platform' | 'first-party';
  readonly criticality: CriticalityRole | null;
  readonly classification: PolicyClassification;
};

export type PolicyPackage = {
  readonly name: string;
  readonly ecosystem: string;
  readonly classification: PolicyClassification;
  readonly role?: string;
  readonly criticality?: CriticalityRole;
  readonly source?: string;
  readonly cryptoRegistered?: boolean;
  readonly notes?: string;
  readonly expiresUtc?: string;
};

export type DependencyPolicy = {
  readonly schemaVersion: 1;
  readonly owner: 'packages/sunrey-chain';
  readonly notLegalAdvice: true;
  readonly popularityIsNotSecurity: true;
  readonly packages: readonly PolicyPackage[];
  readonly unknownDefault: PolicyClassification;
  readonly failurePolicy: {
    readonly blocked: 'fail';
    readonly unregisteredCrypto: 'fail';
    readonly unlockedDependency: 'fail';
    readonly knownHighAdvisory: 'fail';
    readonly yanked: 'fail';
    readonly licenseReview: 'report';
    readonly unmaintained: 'warn';
    readonly duplicateRisk: 'warn';
  };
};

export type AuditFinding = {
  readonly kind: AuditKind;
  readonly name: string;
  readonly severity: 'fail' | 'warn' | 'report';
  readonly detail: string;
};

export type LicenseRecord = {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly reviewFlag: boolean;
  readonly reviewReason: string | null;
  readonly legalConclusion: null;
};

export type ReleaseAuthority = {
  readonly kind: 'SOFTWARE_RELEASE_AUTHORITY';
  readonly authorityId: string;
  readonly publicKeyHex: string;
  readonly suiteId: string;
  readonly notAppAuthorityGrant: true;
  readonly notValidatorGovernance: true;
  readonly notCustodySigner: true;
  readonly notWalletSigner: true;
  readonly mayChangeBlockchainState: false;
};

export type SignedArtifact = {
  readonly artifactDigest: string;
  readonly publicKeyHex: string;
  readonly signatureHex: string;
  readonly suiteId: string;
  readonly authorityId: string;
};

export type CycloneDxSbom = {
  readonly bomFormat: 'CycloneDX';
  readonly specVersion: '1.5';
  readonly version: 1;
  readonly metadata: {
    readonly timestamp: string;
    readonly component: {
      readonly type: 'application';
      readonly name: string;
      readonly version: string;
    };
  };
  readonly components: readonly {
    readonly type: string;
    readonly name: string;
    readonly version: string;
    readonly hashes: readonly { readonly alg: 'SHA-256'; readonly content: string }[];
    readonly supplier?: { readonly name: string };
    readonly licenses?: readonly { readonly license: { readonly id?: string; readonly name?: string } }[];
  }[];
  readonly dependencies?: readonly { readonly ref: string; readonly dependsOn: readonly string[] }[];
};

export type BuildProvenance = {
  readonly _type: 'https://in-toto.io/Statement/v1';
  readonly predicateType: 'https://slsa.dev/provenance/v1';
  readonly subject: readonly { readonly name: string; readonly digest: { readonly sha256: string } }[];
  readonly predicate: {
    readonly buildDefinition: {
      readonly buildType: 'https://sunrey.dev/supply-chain/build@v1';
      readonly externalParameters: {
        readonly sourceRepository: string;
        readonly sourceCommit: string;
        readonly protocolVersion: string;
        readonly networkCompatibility: string;
      };
      readonly resolvedDependencies: {
        readonly packageLock: string;
        readonly cargoLockRust: string;
        readonly cargoLockNode: string;
      };
    };
    readonly runDetails: {
      readonly builder: { readonly id: string };
      readonly metadata: {
        readonly invocationId: string;
        readonly startedOn: string;
        readonly finishedOn: string;
      };
      readonly byproducts: readonly { readonly name: string; readonly digest: { readonly sha256: string } }[];
    };
  };
};

export type SupplyChainReleaseRecord = {
  readonly releaseId: string;
  readonly sourceCommit: string;
  readonly artifactDigests: Readonly<Record<string, string>>;
  readonly sbomDigest: string;
  readonly provenanceDigest: string;
  readonly signatureIdentity: string;
  readonly protocolCompatibility: string;
  readonly createdAtUtc: string;
  readonly status: ReleaseStatus;
  readonly environment: 'simulation';
  readonly reproduced: ReproStatus;
};

export type VerificationInput = {
  readonly artifact: string;
  readonly manifest: SupplyChainReleaseRecord;
  readonly signature: SignedArtifact;
  readonly sbom: CycloneDxSbom;
  readonly provenance: BuildProvenance;
  readonly expectedCommit: string;
  readonly expectedToolchain: string;
  readonly expectedProtocol: string;
  readonly expectedNetwork: string;
  readonly authority: ReleaseAuthority;
};

export type VerificationResult = {
  readonly ok: boolean;
  readonly checks: readonly { readonly id: string; readonly ok: boolean; readonly detail: string }[];
};

export type BuildComparison = {
  readonly builderA: string;
  readonly builderB: string;
  readonly status: ReproStatus;
  readonly differences: readonly { readonly path: string; readonly digestA: string; readonly digestB: string }[];
};

export const LICENSES_REQUIRING_REVIEW = [
  'GPL-2.0',
  'GPL-3.0',
  'AGPL-3.0',
  'SSPL-1.0',
  'BUSL-1.1',
  'UNKNOWN',
] as const;

export const RELEASE_TARGETS = [
  'sunrey-node',
  'sunrey-rpc',
  'sunrey-explorer',
  'sunrey-faucet',
  'sunrey-relayer',
  'sunrey-sdk',
  'sunrey-exchange',
  'sunrey-custody',
] as const;
export type ReleaseTarget = (typeof RELEASE_TARGETS)[number];
