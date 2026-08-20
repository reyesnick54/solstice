/**
 * Parameter coverage and human-decision inventory.
 *
 * Every Chunk 143 parameter ID must have a deliberate state.
 * Missing parameters cannot silently pass. Cursor / AI cannot
 * select production values.
 */

import { PRODUCTION_PARAMETER_IDS, type ProductionParameterId, type ProductionParameterRecord } from '../../../economics/production-activation/types.ts';
import { classifyParameter } from '../../../economics/production-activation/parameters.ts';

import type { HumanEconomicDecisionRequired, ParameterCoverageRecord, ParameterCoverageStatus } from './types.ts';

const HUMAN_DECISION_TITLES: Readonly<Record<ProductionParameterId, string>> = Object.freeze({
  SUNREY_MAXIMUM_SUPPLY: 'SunRey max supply',
  MOONREY_MAXIMUM_SUPPLY: 'MoonRey max supply',
  SUNREY_GENESIS_SUPPLY: 'SunRey genesis supply',
  MOONREY_GENESIS_SUPPLY: 'MoonRey genesis supply',
  SUNREY_POST_GENESIS_ISSUANCE_POLICY: 'SunRey issuance policy values',
  MOONREY_POST_GENESIS_ISSUANCE_POLICY: 'MoonRey issuance policy values',
  SUNREY_CONTRIBUTION_TO_SETTLEMENT_CONVERSION: 'SunRey conversion rate',
  MOONREY_GPUV_TO_SETTLEMENT_CONVERSION: 'MoonRey conversion rate',
  SUNREY_PER_PERIOD_CAPS: 'SunRey caps',
  MOONREY_PER_PERIOD_CAPS: 'MoonRey caps',
  GLOBAL_SUPPLY_GUARDS: 'global supply guards',
  PER_CLASS_CAPS: 'per-class caps',
  FEE_POLICY: 'fee policy parameters',
  BURN_POLICY: 'burn policy parameters',
  GENESIS_ALLOCATION_MANIFEST: 'genesis allocations',
});

const REJECTED_SOURCES = new Set([
  'SIMULATION',
  'DEVELOPMENT',
  'ENGINEERING_SIMULATION_PARAMETERS',
  'FIXTURE',
  'REHEARSAL',
  'REHEARSAL_ONLY',
]);

export function coverageStatusOf(record: ProductionParameterRecord): ParameterCoverageStatus {
  const classified = classifyParameter(record);
  if (REJECTED_SOURCES.has(record.sourceClass) && !record.infrastructureMetadataOnly) {
    return 'FIXTURE_ONLY';
  }
  if (classified.status === 'REJECTED_SOURCE') {
    return 'INVALID';
  }
  if (classified.status === 'UNCONFIGURED' || record.versionId === null || record.valueHash === null) {
    return 'UNCONFIGURED';
  }
  if (!record.governed) {
    return 'MISSING_GOVERNANCE';
  }
  if (classified.status === 'CONFIGURED') {
    return 'CONFIGURED_CANDIDATE';
  }
  return 'UNCONFIGURED';
}

export function parameterCoverage(parameters: readonly ProductionParameterRecord[]): readonly ParameterCoverageRecord[] {
  const byId = new Map(parameters.map((row) => [row.id, row]));
  return Object.freeze(
    PRODUCTION_PARAMETER_IDS.map((id) => {
      const found = byId.get(id);
      if (!found) {
        return Object.freeze({
          id,
          status: 'UNCONFIGURED' as const,
          versionId: null,
          valueHash: null,
          sourceClass: 'MISSING',
          notes: 'parameter missing from package; cannot silently pass',
        });
      }
      const status = coverageStatusOf(found);
      return Object.freeze({
        id,
        status,
        versionId: found.versionId,
        valueHash: found.valueHash,
        sourceClass: found.sourceClass,
        notes:
          status === 'UNCONFIGURED'
            ? 'real production value is not selected'
            : status === 'FIXTURE_ONLY'
              ? 'rehearsal/fixture values cannot qualify as production candidates'
              : status === 'CONFIGURED_CANDIDATE'
                ? 'governed candidate value bound by exact version and hash'
                : `parameter state ${status}`,
      });
    }),
  );
}

export function duplicateParameterIds(parameters: readonly ProductionParameterRecord[]): readonly ProductionParameterId[] {
  const seen = new Set<ProductionParameterId>();
  const duplicates: ProductionParameterId[] = [];
  for (const row of parameters) {
    if (seen.has(row.id)) {
      duplicates.push(row.id);
    }
    seen.add(row.id);
  }
  return Object.freeze(duplicates);
}

export function missingParameterIds(parameters: readonly ProductionParameterRecord[]): readonly ProductionParameterId[] {
  const present = new Set(parameters.map((row) => row.id));
  return Object.freeze(PRODUCTION_PARAMETER_IDS.filter((id) => !present.has(id)));
}

export function visibleUnconfiguredParameters(
  coverage: readonly ParameterCoverageRecord[],
): readonly ProductionParameterId[] {
  return Object.freeze(
    coverage.filter((row) => row.status !== 'CONFIGURED_CANDIDATE').map((row) => row.id),
  );
}

export function humanParameterSelectionDecisions(
  coverage: readonly ParameterCoverageRecord[],
): readonly HumanEconomicDecisionRequired[] {
  return Object.freeze(
    coverage
      .filter((row) => row.status !== 'CONFIGURED_CANDIDATE')
      .map((row) =>
        Object.freeze({
          decisionId: `parameter-selection.${row.id}`,
          kind: 'PARAMETER_SELECTION' as const,
          title: HUMAN_DECISION_TITLES[row.id],
          parameterId: row.id,
          unresolved: true as const,
          aiMayDecide: false as const,
        }),
      ),
  );
}

export function humanActivationAuthorizationRequired(): readonly HumanEconomicDecisionRequired[] {
  return Object.freeze([
    Object.freeze({
      decisionId: 'final-activation-authorization',
      kind: 'FINAL_ACTIVATION_AUTHORIZATION' as const,
      title: 'Final production activation authorization',
      parameterId: null,
      unresolved: true as const,
      aiMayDecide: false as const,
    }),
  ]);
}

export function additionalUnconfiguredPolicyDecisions(): readonly HumanEconomicDecisionRequired[] {
  return Object.freeze([
    Object.freeze({
      decisionId: 'sunrey-valuation-policy-values',
      kind: 'PARAMETER_SELECTION' as const,
      title: 'SunRey valuation policy values',
      parameterId: 'SUNREY_CONTRIBUTION_TO_SETTLEMENT_CONVERSION' as ProductionParameterId,
      unresolved: true as const,
      aiMayDecide: false as const,
    }),
    Object.freeze({
      decisionId: 'moonrey-productive-value-schedule',
      kind: 'PARAMETER_SELECTION' as const,
      title: 'MoonRey Productive Value schedule',
      parameterId: 'MOONREY_POST_GENESIS_ISSUANCE_POLICY' as ProductionParameterId,
      unresolved: true as const,
      aiMayDecide: false as const,
    }),
  ]);
}
