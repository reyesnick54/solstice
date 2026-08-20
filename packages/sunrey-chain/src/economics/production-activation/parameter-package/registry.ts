/**
 * Inert candidate-package registry. Historical hashes remain verifiable.
 * Construction never mutates supply, mint, fees, burn, genesis, or LIVE flags.
 */

import { definitionFor } from './definitions.ts';
import { validateParameterPackage } from './validation.ts';
import type {
  ParameterPackageDiff,
  ProductionEconomicParameterPackage,
  ProductionEconomicParameterPackageInput,
} from './types.ts';

export type ProductionEconomicParameterRegistry = {
  readonly packages: readonly ProductionEconomicParameterPackage[];
};

export function emptyParameterRegistry(): ProductionEconomicParameterRegistry {
  return Object.freeze({ packages: Object.freeze([]) });
}

export function registerParameterPackage(
  registry: ProductionEconomicParameterRegistry,
  input: ProductionEconomicParameterPackageInput,
): ProductionEconomicParameterRegistry {
  const validated = validateParameterPackage(input);
  return Object.freeze({
    packages: Object.freeze([...registry.packages, validated.package]),
  });
}

export function packageById(
  registry: ProductionEconomicParameterRegistry,
  packageId: string,
): ProductionEconomicParameterPackage | undefined {
  return registry.packages.find((row) => row.packageId === packageId);
}

export function packageByHash(
  registry: ProductionEconomicParameterRegistry,
  packageHash: string,
): ProductionEconomicParameterPackage | undefined {
  return registry.packages.find((row) => row.packageHash === packageHash);
}

export function supersedeParameterPackage(
  registry: ProductionEconomicParameterRegistry,
  previousPackageId: string,
  next: ProductionEconomicParameterPackageInput,
): ProductionEconomicParameterRegistry {
  const previous = packageById(registry, previousPackageId);
  const superseded = previous
    ? Object.freeze({
        ...previous,
        supersededBy: next.packageId,
        state: 'SUPERSEDED' as const,
      })
    : undefined;
  const registered = registerParameterPackage(registry, {
    ...next,
    supersedes: previousPackageId,
    supersededBy: null,
  });
  if (!superseded) {
    return registered;
  }
  return Object.freeze({
    packages: Object.freeze(
      registered.packages.map((row) => (row.packageId === previousPackageId ? superseded : row)),
    ),
  });
}

export function diffProductionParameterPackages(
  oldPackage: ProductionEconomicParameterPackage,
  nextPackage: ProductionEconomicParameterPackage,
): ParameterPackageDiff {
  const oldById = new Map(oldPackage.parameters.map((row) => [row.parameterId, row]));
  const nextById = new Map(nextPackage.parameters.map((row) => [row.parameterId, row]));
  const ids = new Set([...oldById.keys(), ...nextById.keys()]);
  const changedParameters = [...ids]
    .map((parameterId) => {
      const previous = oldById.get(parameterId);
      const next = nextById.get(parameterId);
      const oldHash = previous?.parameterHash ?? null;
      const newHash = next?.parameterHash ?? null;
      if (oldHash === newHash) {
        return null;
      }
      return Object.freeze({
        parameterId,
        oldHash,
        newHash,
        economicCritical: definitionFor(parameterId).productionCritical,
      });
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const oldEvidence = evidenceIds(oldPackage);
  const nextEvidence = evidenceIds(nextPackage);
  const addedEvidence = [...nextEvidence].filter((id) => !oldEvidence.has(id));
  const removedEvidence = [...oldEvidence].filter((id) => !nextEvidence.has(id));
  const governanceChanges: string[] = [];
  if (oldPackage.governanceEvidence.length !== nextPackage.governanceEvidence.length) {
    governanceChanges.push('governance-evidence-count');
  }
  if (oldPackage.state !== nextPackage.state) {
    governanceChanges.push(`state:${oldPackage.state}->${nextPackage.state}`);
  }
  if (oldPackage.supersedes !== nextPackage.supersedes || oldPackage.supersededBy !== nextPackage.supersededBy) {
    governanceChanges.push('supersession');
  }

  return Object.freeze({
    changedParameters: Object.freeze(changedParameters),
    addedEvidence: Object.freeze(addedEvidence),
    removedEvidence: Object.freeze(removedEvidence),
    governanceChanges: Object.freeze(governanceChanges),
    autoApproved: false,
  });
}

function evidenceIds(pkg: ProductionEconomicParameterPackage): Set<string> {
  return new Set(
    [...pkg.governanceEvidence, ...pkg.externalEvidence, ...pkg.humanEvidence].map((row) => row.evidenceId),
  );
}

export function registryMutatesSupply(): false {
  return false;
}

export function registryMints(): false {
  return false;
}
