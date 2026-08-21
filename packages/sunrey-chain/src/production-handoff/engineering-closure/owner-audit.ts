import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { hashAudit } from './hash.ts';
import type { ProtectedOwnerAudit, ProtectedOwnerAuditRow } from './types.ts';

type ManifestCapability = {
  readonly id: string;
  readonly status: string;
  readonly owner: string | null;
  readonly protected: boolean;
  readonly supersededBy?: readonly string[];
};

type ManifestComponent = {
  readonly id: string;
  readonly canonicalOwner: string;
  readonly canonicalPath: string;
  readonly protected: boolean;
  readonly financialStateMutation: boolean;
  readonly kernelAuthorizationRequired: boolean;
  readonly executionAuthorityRequired: boolean;
  readonly protectedSymbols: readonly { readonly name: string }[];
  readonly forbiddenAliases: readonly string[];
};

type ManifestPackage = {
  readonly id: string;
  readonly financialStateMutation: boolean;
  readonly kernelAuthorizationRequired: boolean;
  readonly executionAuthorityRequired: boolean;
};

type ArchitectureManifest = {
  readonly capabilities: readonly ManifestCapability[];
  readonly components: readonly ManifestComponent[];
  readonly packages: readonly ManifestPackage[];
};

export function loadArchitectureManifest(root = process.cwd()): ArchitectureManifest {
  return JSON.parse(readFileSync(join(root, 'docs/architecture/manifest.json'), 'utf8')) as ArchitectureManifest;
}

export function buildProtectedOwnerAudit(root = process.cwd()): ProtectedOwnerAudit {
  const manifest = loadArchitectureManifest(root);
  const capabilityIds = manifest.capabilities.map((row) => row.id);
  const capabilityIdsUnique = new Set(capabilityIds).size === capabilityIds.length;

  const ownerByCapability = new Map<string, string | null>();
  const duplicateIds = new Set<string>();
  for (const capability of manifest.capabilities) {
    if (ownerByCapability.has(capability.id)) {
      duplicateIds.add(capability.id);
    }
    ownerByCapability.set(capability.id, capability.owner);
  }

  const symbolOwners = new Map<string, string>();
  const duplicateSymbols = new Set<string>();
  for (const component of manifest.components) {
    if (!component.protected) continue;
    for (const symbol of component.protectedSymbols) {
      const key = `${symbol.name}`;
      const previous = symbolOwners.get(key);
      if (previous && previous !== component.canonicalOwner) {
        duplicateSymbols.add(key);
      } else {
        symbolOwners.set(key, component.canonicalOwner);
      }
    }
  }

  const rows = manifest.capabilities.map((capability) => {
    const ownerComponent =
      manifest.components.find((item) => item.id === capability.id) ??
      manifest.components.find((item) => capability.owner !== null && item.canonicalOwner === capability.owner);
    const pkg = manifest.packages.find((item) => item.id === capability.owner);
    const duplicateOwnerCount =
      (duplicateIds.has(capability.id) ? 1 : 0) +
      (capability.owner
        ? manifest.capabilities.filter((item) => item.id === capability.id && item.owner !== capability.owner).length
        : 0);
    const row: ProtectedOwnerAuditRow = {
      capabilityId: capability.id,
      status: capability.supersededBy?.length ? 'SUPERSEDED' : capability.status,
      canonicalOwner: capability.owner,
      canonicalPath: ownerComponent?.canonicalPath ?? (capability.owner ? `${capability.owner}` : null),
      protectedSymbols: ownerComponent?.protectedSymbols.map((symbol) => symbol.name) ?? [],
      financialStateMutation: ownerComponent?.financialStateMutation ?? pkg?.financialStateMutation ?? false,
      kernelRequirement: ownerComponent?.kernelAuthorizationRequired ?? pkg?.kernelAuthorizationRequired ?? false,
      executionAuthorityRequirement:
        ownerComponent?.executionAuthorityRequired ?? pkg?.executionAuthorityRequired ?? false,
      forbiddenAliases: ownerComponent?.forbiddenAliases ?? [],
      duplicateOwnerCount,
      supersededBy: capability.supersededBy ?? [],
    };
    return Object.freeze(row);
  });

  const duplicateOwnerCount = rows.reduce((sum, row) => sum + row.duplicateOwnerCount, 0) + duplicateSymbols.size;
  const audit = {
    schemaVersion: 1 as const,
    rows: Object.freeze(rows),
    capabilityIdsUnique,
    protectedOwnersUnique: duplicateOwnerCount === 0 && duplicateSymbols.size === 0,
    duplicateOwnerCount,
    hash: '',
  };
  return Object.freeze({
    ...audit,
    hash: hashAudit({
      capabilityIdsUnique: audit.capabilityIdsUnique,
      protectedOwnersUnique: audit.protectedOwnersUnique,
      duplicateOwnerCount: audit.duplicateOwnerCount,
      rows: audit.rows.map((row) => row.capabilityId),
    }),
  });
}
