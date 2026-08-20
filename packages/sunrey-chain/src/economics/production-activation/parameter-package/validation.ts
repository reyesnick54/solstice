/**
 * Structural, dependency, and cross-parameter validation.
 * Does not choose tokenomics and does not activate production.
 */

import { PRODUCTION_PARAMETER_IDS, type ProductionParameterId } from '../types.ts';

import { finalizeCandidate, hashParameterPackage } from './canonical.ts';
import { definitionFor, expectedValueKind } from './definitions.ts';
import {
  collectAuthorizationFailures,
  externalEvidencePresent,
  humanEvidencePresent,
  protocolEvidencePresent,
  rejectAiParameterApproval,
} from './governance.ts';
import {
  FORBIDDEN_PARAMETER_SOURCE_CLASSES,
  PARAMETER_SOURCE_CLASSES,
  PRODUCTION_PARAMETER_PACKAGE_SCHEMA_VERSION,
  type ParameterBlockingCode,
  type ParameterCoverageReport,
  type ParameterCoverageRow,
  type ParameterCoverageStatus,
  type ParameterPackageState,
  type ParameterSourceClass,
  type ProductionEconomicParameterPackage,
  type ProductionEconomicParameterPackageInput,
  type ProductionParameterCandidate,
  type ProductionParameterCandidateInput,
  type ProductionParameterValue,
} from './types.ts';
import { ParameterValueError, assertBigintMinorUnits } from './values.ts';

export function isCanonicalSourceClass(sourceClass: string): sourceClass is ParameterSourceClass {
  return (PARAMETER_SOURCE_CLASSES as readonly string[]).includes(sourceClass);
}

export function sourceClassRejected(sourceClass: string): ParameterBlockingCode | null {
  if ((FORBIDDEN_PARAMETER_SOURCE_CLASSES as readonly string[]).includes(sourceClass)) {
    return 'PRODUCTION_SOURCE_CLASS_REJECTED';
  }
  if (!isCanonicalSourceClass(sourceClass)) {
    return 'ARBITRARY_SOURCE_CLASS';
  }
  return null;
}

function quantityOf(
  parameters: readonly ProductionParameterCandidateInput[],
  id: ProductionParameterId,
): bigint | null {
  const found = parameters.find((row) => row.parameterId === id && row.value?.kind === 'QUANTITY');
  return found && found.value?.kind === 'QUANTITY' ? found.value.minorUnits : null;
}

function present(parameters: readonly ProductionParameterCandidateInput[], id: ProductionParameterId): boolean {
  return parameters.some((row) => row.parameterId === id && row.value !== null);
}

function validateTypedValue(
  parameterId: ProductionParameterId,
  value: ProductionParameterValue | null,
  valueKind: string,
): ParameterBlockingCode[] {
  const codes: ParameterBlockingCode[] = [];
  const expected = expectedValueKind(parameterId);
  if (valueKind !== expected) {
    codes.push('VALUE_KIND_MISMATCH');
  }
  if (value === null) {
    return codes;
  }
  if (value.kind !== expected) {
    codes.push('VALUE_KIND_MISMATCH');
    return codes;
  }
  try {
    if (value.kind === 'QUANTITY') {
      assertBigintMinorUnits(value.minorUnits, parameterId);
      if (value.minorUnits < 0n) {
        codes.push('NEGATIVE_QUANTITY');
      }
    }
    if (value.kind === 'RATIONAL_CONVERSION') {
      assertBigintMinorUnits(value.numerator, 'numerator');
      assertBigintMinorUnits(value.denominator, 'denominator');
      if (value.denominator === 0n) {
        codes.push('RATIONAL_DENOMINATOR_ZERO');
      }
      if (value.denominator < 0n) {
        codes.push('RATIONAL_DENOMINATOR_NEGATIVE');
      }
    }
    if (value.kind === 'CAP_SCHEDULE') {
      for (const cap of value.caps) {
        assertBigintMinorUnits(cap.quantityMinorUnits, cap.scope);
        if (cap.quantityMinorUnits < 0n) {
          codes.push('NEGATIVE_CAP');
        }
      }
    }
    if (value.kind === 'GENESIS_ALLOCATION_REFERENCE') {
      for (const line of value.lines) {
        assertBigintMinorUnits(line.quantityMinorUnits, 'allocation');
        if (line.quantityMinorUnits < 0n) {
          codes.push('NEGATIVE_QUANTITY');
        }
      }
    }
    if (value.kind === 'SUPPLY_GUARD_POLICY' && value.issuedSupplyObserved !== 'UNCONFIGURED') {
      assertBigintMinorUnits(value.issuedSupplyObserved, 'issuedSupplyObserved');
      if (value.issuedSupplyObserved < 0n) {
        codes.push('NEGATIVE_QUANTITY');
      }
    }
  } catch (error) {
    if (error instanceof ParameterValueError && error.code === 'FLOAT_QUANTITY_REJECTED') {
      codes.push('FLOAT_QUANTITY_REJECTED');
    } else {
      codes.push('NON_BIGINT_QUANTITY');
    }
  }
  return codes;
}

function crossParameterCodes(parameters: readonly ProductionParameterCandidateInput[]): ParameterBlockingCode[] {
  const codes: ParameterBlockingCode[] = [];
  const sunreyMax = quantityOf(parameters, 'SUNREY_MAXIMUM_SUPPLY');
  const moonreyMax = quantityOf(parameters, 'MOONREY_MAXIMUM_SUPPLY');
  const sunreyGenesis = quantityOf(parameters, 'SUNREY_GENESIS_SUPPLY');
  const moonreyGenesis = quantityOf(parameters, 'MOONREY_GENESIS_SUPPLY');
  if (sunreyMax !== null && sunreyMax < 0n) {
    codes.push('NEGATIVE_QUANTITY');
  }
  if (moonreyMax !== null && moonreyMax < 0n) {
    codes.push('NEGATIVE_QUANTITY');
  }
  if (sunreyGenesis !== null && sunreyMax !== null && sunreyGenesis > sunreyMax) {
    codes.push('GENESIS_EXCEEDS_MAXIMUM');
  }
  if (moonreyGenesis !== null && moonreyMax !== null && moonreyGenesis > moonreyMax) {
    codes.push('GENESIS_EXCEEDS_MAXIMUM');
  }

  for (const row of parameters) {
    if (row.value?.kind !== 'CAP_SCHEDULE') {
      continue;
    }
    const max =
      row.value.assetId === 'SUNREY_COIN' ? sunreyMax : row.value.assetId === 'MOONREY_COIN' ? moonreyMax : null;
    for (const cap of row.value.caps) {
      if (cap.scope === 'GLOBAL_ISSUANCE_CEILING' && max !== null && cap.quantityMinorUnits > max) {
        codes.push('ISSUANCE_CAP_EXCEEDS_MAXIMUM');
      }
    }
  }

  const guard = parameters.find((row) => row.value?.kind === 'SUPPLY_GUARD_POLICY')?.value;
  if (guard && guard.kind === 'SUPPLY_GUARD_POLICY' && guard.issuedSupplyObserved !== 'UNCONFIGURED') {
    const max =
      guard.maximumSupplyRef === 'SUNREY_MAXIMUM_SUPPLY'
        ? sunreyMax
        : guard.maximumSupplyRef === 'MOONREY_MAXIMUM_SUPPLY'
          ? moonreyMax
          : null;
    if (max !== null && guard.issuedSupplyObserved > max) {
      codes.push('ISSUED_EXCEEDS_MAXIMUM');
    }
  }

  const allocation = parameters.find((row) => row.value?.kind === 'GENESIS_ALLOCATION_REFERENCE')?.value;
  if (allocation && allocation.kind === 'GENESIS_ALLOCATION_REFERENCE' && allocation.lines.length > 0) {
    const sunreySum = allocation.lines
      .filter((line) => line.assetId === 'SUNREY_COIN')
      .reduce((sum, line) => sum + line.quantityMinorUnits, 0n);
    const moonreySum = allocation.lines
      .filter((line) => line.assetId === 'MOONREY_COIN')
      .reduce((sum, line) => sum + line.quantityMinorUnits, 0n);
    if (sunreyGenesis !== null && sunreySum !== sunreyGenesis) {
      codes.push('ALLOCATION_SUM_MISMATCH');
    }
    if (moonreyGenesis !== null && moonreySum !== moonreyGenesis) {
      codes.push('ALLOCATION_SUM_MISMATCH');
    }
    if (allocation.totalByAsset.SUNREY_COIN !== sunreySum || allocation.totalByAsset.MOONREY_COIN !== moonreySum) {
      codes.push('ALLOCATION_SUM_MISMATCH');
    }
  }
  return uniqueCodes(codes);
}

function dependencyCodes(parameters: readonly ProductionParameterCandidateInput[]): Map<ProductionParameterId, ParameterBlockingCode[]> {
  const byId = new Map<ProductionParameterId, ParameterBlockingCode[]>();
  const allocation = parameters.find((row) => row.parameterId === 'GENESIS_ALLOCATION_MANIFEST')?.value;
  const nonzeroAllocation =
    allocation?.kind === 'GENESIS_ALLOCATION_REFERENCE' &&
    allocation.lines.some((line) => line.quantityMinorUnits > 0n);
  for (const id of PRODUCTION_PARAMETER_IDS) {
    const candidate = parameters.find((row) => row.parameterId === id);
    if (!candidate || candidate.value === null) {
      continue;
    }
    const definition = definitionFor(id);
    const missing = definition.dependencies.filter((dep) => !present(parameters, dep));
    if (id === 'GENESIS_ALLOCATION_MANIFEST' && !nonzeroAllocation) {
      continue;
    }
    if (missing.length > 0) {
      byId.set(id, ['DEPENDENCY_MISSING']);
    }
  }
  return byId;
}

function uniqueCodes(codes: readonly ParameterBlockingCode[]): ParameterBlockingCode[] {
  return [...new Set(codes)];
}

function duplicateCodes(parameters: readonly ProductionParameterCandidateInput[]): {
  readonly byId: Map<ProductionParameterId, ParameterBlockingCode[]>;
  readonly aliases: ParameterBlockingCode[];
} {
  const byId = new Map<ProductionParameterId, ParameterBlockingCode[]>();
  const seen = new Map<ProductionParameterId, ProductionParameterCandidateInput[]>();
  for (const row of parameters) {
    const list = seen.get(row.parameterId) ?? [];
    list.push(row);
    seen.set(row.parameterId, list);
  }
  for (const [id, list] of seen) {
    if (list.length < 2) {
      continue;
    }
    const versions = new Set(list.map((row) => row.versionId));
    const hashes = new Set(list.map((row) => `${row.versionId}:${JSON.stringify(row.value?.kind)}:${String(row.value)}`));
    const codes: ParameterBlockingCode[] = ['DUPLICATE_PARAMETER'];
    if (versions.size > 1 || hashes.size > 1) {
      codes.push('DUPLICATE_CONFLICTING_VERSION');
    }
    byId.set(id, codes);
  }
  const aliasMap = new Map<string, ProductionParameterId[]>();
  for (const row of parameters) {
    if (!row.alias) {
      continue;
    }
    const list = aliasMap.get(row.alias) ?? [];
    list.push(row.parameterId);
    aliasMap.set(row.alias, list);
  }
  const aliases: ParameterBlockingCode[] = [];
  for (const ids of aliasMap.values()) {
    if (new Set(ids).size > 1) {
      aliases.push('DUPLICATE_ALIAS');
    }
  }
  return { byId, aliases };
}

function coverageStatusFor(input: {
  readonly present: boolean;
  readonly codes: readonly ParameterBlockingCode[];
  readonly awaitingGovernance: boolean;
}): ParameterCoverageStatus {
  if (input.codes.includes('DUPLICATE_PARAMETER') || input.codes.includes('DUPLICATE_CONFLICTING_VERSION')) {
    return 'DUPLICATE';
  }
  if (input.codes.includes('ARBITRARY_SOURCE_CLASS') || input.codes.includes('PRODUCTION_SOURCE_CLASS_REJECTED')) {
    return 'REJECTED_SOURCE';
  }
  if (
    input.codes.some((code) =>
      [
        'VALUE_KIND_MISMATCH',
        'FLOAT_QUANTITY_REJECTED',
        'NON_BIGINT_QUANTITY',
        'NEGATIVE_QUANTITY',
        'NEGATIVE_CAP',
        'RATIONAL_DENOMINATOR_ZERO',
        'RATIONAL_DENOMINATOR_NEGATIVE',
        'GENESIS_EXCEEDS_MAXIMUM',
        'ISSUANCE_CAP_EXCEEDS_MAXIMUM',
        'ISSUED_EXCEEDS_MAXIMUM',
        'ALLOCATION_SUM_MISMATCH',
      ].includes(code),
    )
  ) {
    return 'INVALID';
  }
  if (input.codes.includes('DEPENDENCY_MISSING')) {
    return 'DEPENDENCY_MISSING';
  }
  if (!input.present) {
    return 'MISSING';
  }
  if (input.awaitingGovernance) {
    return 'AWAITING_GOVERNANCE';
  }
  return 'PRESENT';
}

export function derivePackageState(input: {
  readonly parameters: readonly ProductionParameterCandidateInput[];
  readonly structurallyValid: boolean;
  readonly rejected: boolean;
  readonly superseded: boolean;
  readonly hasExternal: boolean;
  readonly hasHuman: boolean;
  readonly hasGovernance: boolean;
}): ParameterPackageState {
  if (input.superseded) {
    return 'SUPERSEDED';
  }
  if (input.rejected || !input.structurallyValid) {
    return input.parameters.length === 0 || input.parameters.every((row) => row.value === null)
      ? 'UNCONFIGURED'
      : 'REJECTED';
  }
  if (input.parameters.every((row) => row.value === null) && input.parameters.length === 0) {
    return 'UNCONFIGURED';
  }
  const anyPresent = input.parameters.some((row) => row.value !== null);
  if (!anyPresent) {
    return 'UNCONFIGURED';
  }
  const allFixture = input.parameters.filter((row) => row.value !== null).every((row) => row.fixture || row.rehearsalOnly);
  if (allFixture) {
    return 'DRAFT_CANDIDATE';
  }
  if (!input.hasExternal) {
    return 'EXTERNAL_REVIEW_REQUIRED';
  }
  if (!input.hasHuman || !input.hasGovernance) {
    return 'HUMAN_GOVERNANCE_REQUIRED';
  }
  return 'GOVERNANCE_CANDIDATE';
}

export function validateParameterPackage(input: ProductionEconomicParameterPackageInput): {
  readonly package: ProductionEconomicParameterPackage;
  readonly coverage: ParameterCoverageReport;
  readonly blockingCodes: readonly ParameterBlockingCode[];
  readonly structurallyValid: boolean;
  readonly productionGovernanceComplete: boolean;
  readonly finalized: readonly ProductionParameterCandidate[];
} {
  const duplicates = duplicateCodes(input.parameters);
  const cross = crossParameterCodes(input.parameters);
  const deps = dependencyCodes(input.parameters);
  const rows: ParameterCoverageRow[] = [];
  const allCodes: ParameterBlockingCode[] = [...duplicates.aliases];
  const finalized: ProductionParameterCandidate[] = [];

  for (const id of PRODUCTION_PARAMETER_IDS) {
    const matches = input.parameters.filter((row) => row.parameterId === id);
    const candidate = matches[0];
    const codes: ParameterBlockingCode[] = [...(duplicates.byId.get(id) ?? []), ...(deps.get(id) ?? [])];
    if (!candidate) {
      rows.push(Object.freeze({ parameterId: id, status: 'MISSING', blockingCodes: Object.freeze(['PARAMETER_UNCONFIGURED'] as const) }));
      allCodes.push('PARAMETER_UNCONFIGURED');
      continue;
    }
    const sourceCode = sourceClassRejected(candidate.sourceClass);
    if (sourceCode) {
      codes.push(sourceCode);
    }
    codes.push(...validateTypedValue(id, candidate.value, candidate.valueKind));
    codes.push(...cross.filter((code) => appliesTo(id, code)));
    for (const ref of [...candidate.humanApprovalReferences, ...candidate.externalEvidenceReferences, candidate.governanceReference ?? '']) {
      const actorGuess = ref.toUpperCase();
      const ai = rejectAiParameterApproval(actorGuess);
      if (ai) {
        codes.push(ai);
      }
    }
    const presentValue = candidate.value !== null;
    const definition = definitionFor(id);
    const awaiting =
      presentValue &&
      !candidate.fixture &&
      (definition.requiresGovernance || definition.requiresHumanReview) &&
      (candidate.humanApprovalReferences.length === 0 || !candidate.governanceReference);
    const status = coverageStatusFor({
      present: presentValue,
      codes: uniqueCodes(codes),
      awaitingGovernance: awaiting,
    });
    if (!presentValue && status === 'MISSING') {
      codes.push('PARAMETER_UNCONFIGURED');
    }
    rows.push(
      Object.freeze({
        parameterId: id,
        status,
        blockingCodes: Object.freeze(uniqueCodes(codes)),
      }),
    );
    allCodes.push(...codes);
    finalized.push(finalizeCandidate(candidate));
  }

  for (const extra of input.parameters) {
    if (!(PRODUCTION_PARAMETER_IDS as readonly string[]).includes(extra.parameterId)) {
      allCodes.push('UNKNOWN_PARAMETER_ID');
    }
  }

  const authFailures = collectAuthorizationFailures([
    ...input.governanceEvidence,
    ...input.externalEvidence,
    ...input.humanEvidence,
  ]);
  allCodes.push(...authFailures);

  const hasHuman = humanEvidencePresent(input.humanEvidence);
  const hasExternal = externalEvidencePresent(input.externalEvidence);
  const hasGovernance = protocolEvidencePresent(input.governanceEvidence) || hasHuman;
  const hardInvalid = uniqueCodes(allCodes).some((code) =>
    [
      'ARBITRARY_SOURCE_CLASS',
      'PRODUCTION_SOURCE_CLASS_REJECTED',
      'DUPLICATE_PARAMETER',
      'DUPLICATE_CONFLICTING_VERSION',
      'DUPLICATE_ALIAS',
      'DEPENDENCY_MISSING',
      'VALUE_KIND_MISMATCH',
      'FLOAT_QUANTITY_REJECTED',
      'NON_BIGINT_QUANTITY',
      'NEGATIVE_QUANTITY',
      'NEGATIVE_CAP',
      'RATIONAL_DENOMINATOR_ZERO',
      'RATIONAL_DENOMINATOR_NEGATIVE',
      'GENESIS_EXCEEDS_MAXIMUM',
      'ISSUANCE_CAP_EXCEEDS_MAXIMUM',
      'ISSUED_EXCEEDS_MAXIMUM',
      'ALLOCATION_SUM_MISMATCH',
      'UNKNOWN_PARAMETER_ID',
      'AI_CANNOT_AUTHORIZE_PARAMETER',
    ].includes(code),
  );
  const okStructure = !hardInvalid;
  const anyFixture = input.parameters.some((row) => row.value !== null && (row.fixture || row.rehearsalOnly));
  const productionGovernanceComplete =
    okStructure &&
    !anyFixture &&
    hasHuman &&
    hasGovernance &&
    (!input.parameters.some((row) => row.value !== null && definitionFor(row.parameterId).requiresExternalEvidence) ||
      hasExternal);

  const state = derivePackageState({
    parameters: input.parameters,
    structurallyValid: okStructure,
    rejected: hardInvalid,
    superseded: input.supersededBy !== null,
    hasExternal,
    hasHuman,
    hasGovernance,
  });

  const pkg: ProductionEconomicParameterPackage = Object.freeze({
    packageId: input.packageId,
    schemaVersion: PRODUCTION_PARAMETER_PACKAGE_SCHEMA_VERSION,
    packageVersion: input.packageVersion,
    sourceCommit: input.sourceCommit,
    parameters: Object.freeze(finalized),
    bindings: Object.freeze([...input.bindings]),
    governanceEvidence: Object.freeze([...input.governanceEvidence]),
    externalEvidence: Object.freeze([...input.externalEvidence]),
    humanEvidence: Object.freeze([...input.humanEvidence]),
    supersedes: input.supersedes,
    supersededBy: input.supersededBy,
    state,
    productionActivated: false,
    usableAsAutomaticActivation: false,
    packageHash: '',
  });
  const packageHash = hashParameterPackage({ ...pkg, state });
  const hashed = Object.freeze({ ...pkg, packageHash });

  const presentCount = rows.filter((row) => row.status === 'PRESENT' || row.status === 'AWAITING_GOVERNANCE').length;
  const missingCount = rows.filter((row) => row.status === 'MISSING').length;
  const coverage: ParameterCoverageReport = Object.freeze({
    rows: Object.freeze(rows),
    presentCount,
    missingCount,
    productionValuesSelected: false,
  });

  return {
    package: hashed,
    coverage,
    blockingCodes: Object.freeze(uniqueCodes(allCodes)),
    structurallyValid: okStructure,
    productionGovernanceComplete,
    finalized,
  };
}

function appliesTo(id: ProductionParameterId, code: ParameterBlockingCode): boolean {
  if (code === 'GENESIS_EXCEEDS_MAXIMUM') {
    return id === 'SUNREY_GENESIS_SUPPLY' || id === 'MOONREY_GENESIS_SUPPLY';
  }
  if (code === 'ISSUANCE_CAP_EXCEEDS_MAXIMUM' || code === 'ISSUED_EXCEEDS_MAXIMUM') {
    return id === 'SUNREY_PER_PERIOD_CAPS' || id === 'MOONREY_PER_PERIOD_CAPS' || id === 'GLOBAL_SUPPLY_GUARDS' || id === 'PER_CLASS_CAPS';
  }
  if (code === 'ALLOCATION_SUM_MISMATCH') {
    return id === 'GENESIS_ALLOCATION_MANIFEST';
  }
  return false;
}

export function currentRepositoryParameterPackage(): ProductionEconomicParameterPackage {
  const validated = validateParameterPackage({
    packageId: 'sunrey.production-economic-parameters.current.unconfigured.v1',
    schemaVersion: PRODUCTION_PARAMETER_PACKAGE_SCHEMA_VERSION,
    packageVersion: 'unconfigured.v1',
    sourceCommit: 'sunrey.repository.constitution-bound.v1',
    parameters: [],
    bindings: [],
    governanceEvidence: [],
    externalEvidence: [],
    humanEvidence: [],
    supersedes: null,
    supersededBy: null,
  });
  return validated.package;
}
