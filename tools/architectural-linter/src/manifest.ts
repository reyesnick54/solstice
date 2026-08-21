import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const MANIFEST_RELATIVE_PATH = 'docs/architecture/manifest.json';
export const CHUNKS_RELATIVE_DIR = 'docs/architecture/chunks';

export type ImplementationStatus = 'IMPLEMENTED' | 'PARTIAL' | 'PLANNED' | 'ABSENT';

export type ProtectedSymbol = {
  readonly name: string;
  readonly kind: 'class' | 'interface' | 'type' | 'const' | 'function';
};

export type ManifestPackage = {
  readonly id: string;
  readonly npmName: string;
  readonly path: string;
  readonly kind: 'package' | 'service' | 'tool' | 'app';
  readonly status: 'IMPLEMENTED' | 'PARTIAL' | 'PLANNED';
  readonly protected: boolean;
  readonly financialStateMutation: boolean;
  readonly executionAuthorityRequired: boolean;
  readonly kernelAuthorizationRequired: boolean;
  readonly allowedDependencies: readonly string[];
  readonly codeowners: readonly string[];
  readonly notes?: string;
};

export type ManifestComponent = {
  readonly id: string;
  readonly name: string;
  readonly canonicalOwner: string;
  readonly canonicalPath: string;
  readonly publicInterface: string;
  readonly status: 'IMPLEMENTED' | 'PARTIAL' | 'PLANNED';
  readonly protected: boolean;
  readonly financialStateMutation: boolean;
  readonly executionAuthorityRequired: boolean;
  readonly kernelAuthorizationRequired: boolean;
  readonly protectedSymbols: readonly ProtectedSymbol[];
  readonly forbiddenAliases: readonly string[];
  readonly codeowners: readonly string[];
  readonly notes?: string;
};

export type AuthorizedMutationPath = {
  readonly symbol: string;
  readonly file: string;
  readonly requiresExecutionAuthority: boolean;
  readonly requiresKernel: boolean;
};

export type ManifestCapability = {
  readonly id: string;
  readonly status: 'IMPLEMENTED' | 'PARTIAL' | 'PLANNED';
  readonly owner: string | null;
  readonly protected: boolean;
  readonly adr?: string;
  readonly notes?: string;
  readonly supersededBy?: readonly string[];
};

export type ManifestBoundedContext = {
  readonly id: string;
  readonly status: 'IMPLEMENTED' | 'PARTIAL' | 'PLANNED';
  readonly reservedPaths: readonly string[];
  readonly protected: boolean;
  readonly adr?: string;
  readonly notes?: string;
};

export type ArchitectureManifest = {
  readonly schemaVersion: number;
  readonly name: string;
  readonly purpose: string;
  readonly codeownerDefault: string;
  readonly packages: readonly ManifestPackage[];
  readonly components: readonly ManifestComponent[];
  readonly authorizedMutationPaths: readonly AuthorizedMutationPath[];
  readonly allowedCycles: readonly (readonly string[])[];
  readonly forbiddenWorkspaceRoots: readonly string[];
  readonly capabilities: readonly ManifestCapability[];
  readonly boundedContexts: readonly ManifestBoundedContext[];
  readonly liveFlags: readonly { readonly name: string; readonly requiredValue: unknown }[];
};

export type ChunkDeclaration = {
  readonly chunk: string;
  readonly title: string;
  readonly requires: readonly string[];
};

export type CapabilityEvaluation = {
  readonly id: string;
  readonly status: ImplementationStatus;
  readonly protected: boolean;
  readonly owner: string | null;
};

export type ChunkEvaluation = {
  readonly chunk: string;
  readonly requirements: readonly CapabilityEvaluation[];
  readonly mustStop: boolean;
  readonly missing: readonly string[];
};

export function loadManifest(root: string): ArchitectureManifest {
  const path = join(root, MANIFEST_RELATIVE_PATH);
  if (!existsSync(path)) {
    throw new Error(`architecture manifest missing: ${MANIFEST_RELATIVE_PATH}`);
  }
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as ArchitectureManifest;
  if (parsed.schemaVersion !== 1) {
    throw new Error(`unsupported architecture manifest schemaVersion: ${String(parsed.schemaVersion)}`);
  }
  if (!Array.isArray(parsed.packages) || !Array.isArray(parsed.components)) {
    throw new Error('architecture manifest is missing packages or components');
  }
  return parsed;
}

export function packageById(
  manifest: ArchitectureManifest,
  id: string,
): ManifestPackage | undefined {
  return manifest.packages.find((pkg) => pkg.id === id);
}

export function npmNameToPackageId(
  manifest: ArchitectureManifest,
  npmName: string,
): string | undefined {
  return manifest.packages.find((pkg) => pkg.npmName === npmName)?.id;
}

export function evaluateCapability(
  manifest: ArchitectureManifest,
  capabilityId: string,
): CapabilityEvaluation {
  const capability = manifest.capabilities.find((item) => item.id === capabilityId);
  if (!capability) {
    return { id: capabilityId, status: 'ABSENT', protected: false, owner: null };
  }
  return {
    id: capability.id,
    status: capability.status,
    protected: capability.protected,
    owner: capability.owner,
  };
}

export function capabilitySupersessionResolved(
  manifest: ArchitectureManifest,
  capabilityId: string,
): boolean {
  const capability = manifest.capabilities.find((item) => item.id === capabilityId);
  if (!capability?.supersededBy?.length) {
    return false;
  }
  return capability.supersededBy.every((id) => evaluateCapability(manifest, id).status === 'IMPLEMENTED');
}

export function evaluateChunkRequirements(
  manifest: ArchitectureManifest,
  requires: readonly string[],
  chunk = 'anonymous',
): ChunkEvaluation {
  const requirements = requires.map((id) => evaluateCapability(manifest, id));
  const missing = requirements
    .filter((item) => {
      if (!item.protected || item.status === 'IMPLEMENTED') {
        return false;
      }
      return !capabilitySupersessionResolved(manifest, item.id);
    })
    .map((item) => item.id);
  return {
    chunk,
    requirements,
    mustStop: missing.length > 0,
    missing,
  };
}

export function normalizeCycle(nodes: readonly string[]): string {
  return [...new Set(nodes)].sort().join('|');
}
