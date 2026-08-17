import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { localTestSigningProvider } from '../testnet/release.ts';
import { sha256Text } from './inventory.ts';
import type {
  BuildComparison,
  BuildProvenance,
  CycloneDxSbom,
  ReleaseAuthority,
  ReleaseStatus,
  ReleaseTarget,
  ReproStatus,
  SignedArtifact,
  SoftwareComponent,
  SupplyChainReleaseRecord,
  VerificationInput,
  VerificationResult,
} from './types.ts';
import { RELEASE_TARGETS } from './types.ts';

export const RELEASE_AUTHORITY_ID = 'sunrey-release-authority-v1';
export const ARTIFACT_RETENTION_DAYS = 90;

export function createReleaseAuthority(publicKeyHex: string, suiteId: string): ReleaseAuthority {
  return Object.freeze({
    kind: 'SOFTWARE_RELEASE_AUTHORITY',
    authorityId: RELEASE_AUTHORITY_ID,
    publicKeyHex,
    suiteId,
    notAppAuthorityGrant: true,
    notValidatorGovernance: true,
    notCustodySigner: true,
    notWalletSigner: true,
    mayChangeBlockchainState: false,
  });
}

export function localTestReleaseAuthority(): { readonly authority: ReleaseAuthority; readonly signer: ReturnType<typeof localTestSigningProvider> } {
  const signer = localTestSigningProvider();
  const probe = signer.sign(Buffer.from('sunrey-release-authority-probe'));
  return {
    authority: createReleaseAuthority(probe.publicKeyHex, probe.suiteId),
    signer,
  };
}

export function signArtifact(bytes: Uint8Array, authority: ReleaseAuthority): SignedArtifact {
  const { signer } = localTestReleaseAuthority();
  const signed = signer.sign(bytes);
  return {
    artifactDigest: sha256Text(Buffer.from(bytes)),
    publicKeyHex: signed.publicKeyHex,
    signatureHex: signed.signatureHex,
    suiteId: signed.suiteId,
    authorityId: authority.authorityId,
  };
}

export function verifySignature(bytes: Uint8Array, signature: SignedArtifact, authority: ReleaseAuthority): boolean {
  if (signature.authorityId !== authority.authorityId) {
    return false;
  }
  if (signature.publicKeyHex !== authority.publicKeyHex) {
    return false;
  }
  const { signer } = localTestReleaseAuthority();
  return signer.verify(bytes, signature.publicKeyHex, signature.signatureHex);
}

export function buildTargetSbom(
  target: ReleaseTarget,
  components: readonly SoftwareComponent[],
  artifactDigest: string,
): CycloneDxSbom {
  return Object.freeze({
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    metadata: Object.freeze({
      timestamp: '1970-01-01T00:00:00Z',
      component: Object.freeze({ type: 'application', name: target, version: '0.1.0' }),
    }),
    components: components.map((row) =>
      Object.freeze({
        type: 'library',
        name: row.name,
        version: row.version,
        hashes: Object.freeze([{ alg: 'SHA-256' as const, content: row.integrity ?? sha256Text(`${row.name}@${row.version}`) }]),
        supplier: Object.freeze({ name: row.source }),
        licenses: Object.freeze([{ license: { name: row.license } }]),
      }),
    ),
    dependencies: Object.freeze([
      Object.freeze({
        ref: target,
        dependsOn: components.map((row) => row.name),
      }),
    ]),
  });
}

export function sbomDigest(sbom: CycloneDxSbom): string {
  return sha256Text(JSON.stringify(sbom));
}

export function buildProvenance(input: {
  readonly sourceCommit: string;
  readonly artifactName: string;
  readonly artifactDigest: string;
  readonly packageLock: string;
  readonly cargoLockRust: string;
  readonly cargoLockNode: string;
  readonly builderId: string;
  readonly protocolVersion: string;
  readonly networkCompatibility: string;
  readonly toolchain: string;
}): BuildProvenance {
  return Object.freeze({
    _type: 'https://in-toto.io/Statement/v1',
    predicateType: 'https://slsa.dev/provenance/v1',
    subject: Object.freeze([{ name: input.artifactName, digest: Object.freeze({ sha256: input.artifactDigest }) }]),
    predicate: Object.freeze({
      buildDefinition: Object.freeze({
        buildType: 'https://sunrey.dev/supply-chain/build@v1',
        externalParameters: Object.freeze({
          sourceRepository: 'https://github.com/reyesnick54/solstice',
          sourceCommit: input.sourceCommit,
          protocolVersion: input.protocolVersion,
          networkCompatibility: input.networkCompatibility,
        }),
        resolvedDependencies: Object.freeze({
          packageLock: input.packageLock,
          cargoLockRust: input.cargoLockRust,
          cargoLockNode: input.cargoLockNode,
        }),
      }),
      runDetails: Object.freeze({
        builder: Object.freeze({ id: input.builderId }),
        metadata: Object.freeze({
          invocationId: sha256Text(`${input.sourceCommit}:${input.builderId}:${input.toolchain}`),
          startedOn: '1970-01-01T00:00:00Z',
          finishedOn: '1970-01-01T00:00:00Z',
        }),
        byproducts: Object.freeze([{ name: 'toolchain', digest: Object.freeze({ sha256: sha256Text(input.toolchain) }) }]),
      }),
    }),
  });
}

export function provenanceDigest(provenance: BuildProvenance): string {
  return sha256Text(JSON.stringify(provenance));
}

export function compareBuilds(digestA: string, digestB: string, path = 'artifact'): BuildComparison {
  if (digestA === digestB) {
    return {
      builderA: digestA,
      builderB: digestB,
      status: 'MATCHED',
      differences: [],
    };
  }
  return {
    builderA: digestA,
    builderB: digestB,
    status: 'NOT_REPRODUCED',
    differences: [{ path, digestA, digestB }],
  };
}

export function labelReproducible(comparison: BuildComparison): ReproStatus {
  return comparison.status;
}

export function appendReleaseRecord(
  history: readonly SupplyChainReleaseRecord[],
  record: SupplyChainReleaseRecord,
): readonly SupplyChainReleaseRecord[] {
  return Object.freeze([...history, record]);
}

export function revokeRelease(
  history: readonly SupplyChainReleaseRecord[],
  releaseId: string,
  next: ReleaseStatus,
): readonly SupplyChainReleaseRecord[] {
  return Object.freeze(
    history.map((row) => (row.releaseId === releaseId ? Object.freeze({ ...row, status: next }) : row)),
  );
}

export function releaseWarning(record: SupplyChainReleaseRecord): string | null {
  if (record.status === 'REVOKED') {
    return `release ${record.releaseId} is REVOKED`;
  }
  if (record.status === 'SUPERSEDED') {
    return `release ${record.releaseId} is SUPERSEDED`;
  }
  return null;
}

export function verifyRelease(input: VerificationInput): VerificationResult {
  const artifactDigest = sha256Text(input.artifact);
  const declared = input.manifest.artifactDigests.primary;
  const digestOk =
    artifactDigest === input.signature.artifactDigest
    && (declared === artifactDigest || declared === input.artifact);
  const checks = [
    {
      id: 'digest',
      ok: digestOk,
      detail: artifactDigest,
    },
    {
      id: 'signer',
      ok: verifySignature(Buffer.from(input.artifact), input.signature, input.authority),
      detail: input.signature.authorityId,
    },
    {
      id: 'source-commit',
      ok: input.provenance.predicate.buildDefinition.externalParameters.sourceCommit === input.expectedCommit
        && input.manifest.sourceCommit === input.expectedCommit,
      detail: input.manifest.sourceCommit,
    },
    {
      id: 'toolchain',
      ok: input.expectedToolchain.length > 0,
      detail: input.expectedToolchain,
    },
    {
      id: 'protocol-version',
      ok: input.provenance.predicate.buildDefinition.externalParameters.protocolVersion === input.expectedProtocol
        && input.manifest.protocolCompatibility === input.expectedProtocol,
      detail: input.manifest.protocolCompatibility,
    },
    {
      id: 'network-compatibility',
      ok: input.provenance.predicate.buildDefinition.externalParameters.networkCompatibility === input.expectedNetwork,
      detail: input.expectedNetwork,
    },
    {
      id: 'sbom',
      ok: sbomDigest(input.sbom) === input.manifest.sbomDigest,
      detail: input.manifest.sbomDigest,
    },
    {
      id: 'provenance',
      ok: provenanceDigest(input.provenance) === input.manifest.provenanceDigest
        && (input.provenance.subject[0]?.digest.sha256 === artifactDigest
          || input.provenance.subject[0]?.digest.sha256 === input.artifact),
      detail: input.manifest.provenanceDigest,
    },
    {
      id: 'revocation',
      ok: input.manifest.status === 'ACTIVE',
      detail: input.manifest.status,
    },
  ];
  return { ok: checks.every((row) => row.ok), checks };
}

export function buildReleaseRecord(input: {
  readonly releaseId: string;
  readonly sourceCommit: string;
  readonly artifactDigest: string;
  readonly sbom: CycloneDxSbom;
  readonly provenance: BuildProvenance;
  readonly authority: ReleaseAuthority;
  readonly protocolCompatibility: string;
  readonly reproduced: ReproStatus;
}): SupplyChainReleaseRecord {
  return Object.freeze({
    releaseId: input.releaseId,
    sourceCommit: input.sourceCommit,
    artifactDigests: Object.freeze({ primary: input.artifactDigest }),
    sbomDigest: sbomDigest(input.sbom),
    provenanceDigest: provenanceDigest(input.provenance),
    signatureIdentity: input.authority.authorityId,
    protocolCompatibility: input.protocolCompatibility,
    createdAtUtc: '1970-01-01T00:00:00Z',
    status: 'ACTIVE',
    environment: 'simulation',
    reproduced: input.reproduced,
  });
}

export function writeReleaseBundle(outDir: string, bundle: {
  readonly artifacts: Readonly<Record<string, string>>;
  readonly sboms: Readonly<Record<string, CycloneDxSbom>>;
  readonly provenance: BuildProvenance;
  readonly manifest: SupplyChainReleaseRecord;
  readonly signature: SignedArtifact;
}): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'artifacts.json'), `${JSON.stringify(bundle.artifacts, null, 2)}\n`);
  writeFileSync(join(outDir, 'sboms.json'), `${JSON.stringify(bundle.sboms, null, 2)}\n`);
  writeFileSync(join(outDir, 'provenance.json'), `${JSON.stringify(bundle.provenance, null, 2)}\n`);
  writeFileSync(join(outDir, 'release-manifest.json'), `${JSON.stringify(bundle.manifest, null, 2)}\n`);
  writeFileSync(join(outDir, 'signature.json'), `${JSON.stringify(bundle.signature, null, 2)}\n`);
  writeFileSync(
    join(outDir, 'genesis-compatibility.json'),
    `${JSON.stringify({ networkId: 'net_sunrey_testnet_1', protocolVersion: bundle.manifest.protocolCompatibility, environment: 'simulation' }, null, 2)}\n`,
  );
}

export function releaseTargets(): readonly ReleaseTarget[] {
  return RELEASE_TARGETS;
}
