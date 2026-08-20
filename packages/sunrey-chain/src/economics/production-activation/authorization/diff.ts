import { encodeBool, encodeString, encodeU32, sha256Hex } from '../../../validators/canonical.ts';
import { definitionFor } from '../parameter-package/definitions.ts';
import type { ProductionEconomicParameterPackage, ProductionParameterCandidate } from '../parameter-package/types.ts';
import { PRODUCTION_PARAMETER_IDS, type ProductionParameterId } from '../types.ts';

import type { ProductionEconomicParameterDiff } from './types.ts';

const DIFF_DOMAIN = 'SUNREY_PRODUCTION_ECONOMIC_PARAMETER_DIFF_V1' as const;

const CONVERSION_IDS: readonly ProductionParameterId[] = [
  'SUNREY_CONTRIBUTION_TO_SETTLEMENT_CONVERSION',
  'MOONREY_GPUV_TO_SETTLEMENT_CONVERSION',
];
const SUPPLY_LIMIT_IDS: readonly ProductionParameterId[] = [
  'SUNREY_MAXIMUM_SUPPLY',
  'MOONREY_MAXIMUM_SUPPLY',
  'GLOBAL_SUPPLY_GUARDS',
];
const CAP_IDS: readonly ProductionParameterId[] = [
  'SUNREY_PER_PERIOD_CAPS',
  'MOONREY_PER_PERIOD_CAPS',
  'PER_CLASS_CAPS',
];
const GENESIS_IDS: readonly ProductionParameterId[] = [
  'SUNREY_GENESIS_SUPPLY',
  'MOONREY_GENESIS_SUPPLY',
  'GENESIS_ALLOCATION_MANIFEST',
];
const FORMULA_IDS: readonly ProductionParameterId[] = [
  'SUNREY_POST_GENESIS_ISSUANCE_POLICY',
  'MOONREY_POST_GENESIS_ISSUANCE_POLICY',
  'FEE_POLICY',
  'BURN_POLICY',
];

export function diffProductionAuthorizationParameters(
  current: ProductionEconomicParameterPackage,
  proposed: ProductionEconomicParameterPackage,
): ProductionEconomicParameterDiff {
  const currentById = indexById(current.parameters);
  const proposedById = indexById(proposed.parameters);
  const addedParameters = PRODUCTION_PARAMETER_IDS.filter(
    (id) => present(proposedById.get(id)) && !present(currentById.get(id)),
  );
  const removedParameters = PRODUCTION_PARAMETER_IDS.filter(
    (id) => present(currentById.get(id)) && !present(proposedById.get(id)),
  );
  const changedParameters = PRODUCTION_PARAMETER_IDS.filter((id) => {
    const left = currentById.get(id);
    const right = proposedById.get(id);
    if (!present(left) && !present(right)) {
      return false;
    }
    return (left?.parameterHash ?? null) !== (right?.parameterHash ?? null);
  });
  const changedCaps = intersect(changedParameters, CAP_IDS);
  const changedFormulas = intersect(changedParameters, FORMULA_IDS);
  const changedConversionPolicies = intersect(changedParameters, CONVERSION_IDS);
  const changedGenesisAssumptions = intersect(changedParameters, GENESIS_IDS);
  const changedSupplyLimits = intersect(changedParameters, SUPPLY_LIMIT_IDS);
  const changedEligibility = changedParameters.filter((id) => definitionFor(id).requiresHumanReview);
  const changedAuthority = authorityChanges(current, proposed);
  const draft = {
    fromParameterPackageHash: current.packageHash,
    toParameterPackageHash: proposed.packageHash,
    addedParameters,
    removedParameters,
    changedCaps,
    changedFormulas,
    changedConversionPolicies,
    changedEligibility,
    changedGenesisAssumptions,
    changedAuthority,
    changedSupplyLimits,
    changedParameters,
    rehearsalPromoted: false as const,
    autoApproved: false as const,
  };
  return Object.freeze({
    ...draft,
    diffHash: hashParameterDiff(draft),
  });
}

export function hashParameterDiff(
  draft: Omit<ProductionEconomicParameterDiff, 'diffHash'>,
): string {
  const lists: readonly (readonly string[])[] = [
    draft.addedParameters,
    draft.removedParameters,
    draft.changedCaps,
    draft.changedFormulas,
    draft.changedConversionPolicies,
    draft.changedEligibility,
    draft.changedGenesisAssumptions,
    draft.changedAuthority,
    draft.changedSupplyLimits,
    draft.changedParameters,
  ];
  return sha256Hex(
    Buffer.concat([
      encodeString(DIFF_DOMAIN),
      encodeString(draft.fromParameterPackageHash),
      encodeString(draft.toParameterPackageHash),
      ...lists.flatMap((list) => [encodeU32(list.length), ...[...list].sort().map((row) => encodeString(row))]),
      encodeBool(false),
      encodeBool(false),
    ]),
  );
}

export function parameterDiffSummary(diff: ProductionEconomicParameterDiff): string {
  return [
    `added=${diff.addedParameters.length}`,
    `removed=${diff.removedParameters.length}`,
    `changed=${diff.changedParameters.length}`,
    `caps=${diff.changedCaps.length}`,
    `formulas=${diff.changedFormulas.length}`,
    `conversion=${diff.changedConversionPolicies.length}`,
    `eligibility=${diff.changedEligibility.length}`,
    `genesis=${diff.changedGenesisAssumptions.length}`,
    `authority=${diff.changedAuthority.length}`,
    `supply=${diff.changedSupplyLimits.length}`,
    `hash=${diff.diffHash}`,
  ].join('|');
}

function indexById(
  parameters: readonly ProductionParameterCandidate[],
): Map<ProductionParameterId, ProductionParameterCandidate> {
  return new Map(parameters.map((row) => [row.parameterId, row]));
}

function present(candidate: ProductionParameterCandidate | undefined): boolean {
  return candidate !== undefined && candidate.value !== null;
}

function intersect(
  changed: readonly ProductionParameterId[],
  subset: readonly ProductionParameterId[],
): readonly ProductionParameterId[] {
  const set = new Set(subset);
  return changed.filter((id) => set.has(id));
}

function authorityChanges(
  current: ProductionEconomicParameterPackage,
  proposed: ProductionEconomicParameterPackage,
): readonly string[] {
  const changes: string[] = [];
  if (current.state !== proposed.state) {
    changes.push(`state:${current.state}->${proposed.state}`);
  }
  if (current.governanceEvidence.length !== proposed.governanceEvidence.length) {
    changes.push('governance-evidence');
  }
  if (current.humanEvidence.length !== proposed.humanEvidence.length) {
    changes.push('human-evidence');
  }
  return Object.freeze(changes.sort());
}
