import { PRODUCTION_GATE_CATALOG } from './catalog.ts';
import { latestForGate, type EvidenceStore, createEvidenceStore } from './evidence.ts';
import { activeExceptionFor, type ExceptionStore, createExceptionStore } from './exceptions.ts';
import { hashCanonical } from './hash.ts';
import {
  PRODUCTION_GATE_REGISTRY_ID,
  PRODUCTION_GATE_SCHEMA_VERSION,
  PRODUCTION_GATE_TOOL_VERSION,
  isBlockingStatus,
  isExternalKind,
  type ExternalInputRecord,
  type GateDefinition,
  type GateEvidenceStatus,
  type ProductionGateSnapshot,
  type ReleaseDecision,
  type RequiredFor,
} from './types.ts';

export const PRODUCTION_GATE_NOW_UTC = '2026-08-23T00:00:00.000Z' as const;

export type EvaluationStores = {
  readonly evidence?: EvidenceStore;
  readonly exceptions?: ExceptionStore;
};

function statusFor(definition: GateDefinition, evidence: EvidenceStore, nowUtc: string): {
  readonly status: GateEvidenceStatus;
  readonly evidenceReference: string | null;
  readonly expiration: string | null;
  readonly lastValidated: string | null;
} {
  if (definition.kind === 'INTERNAL_SOFTWARE') {
    return {
      status: definition.defaultStatus,
      evidenceReference: `internal:${definition.gateId}`,
      expiration: null,
      lastValidated: nowUtc,
    };
  }
  const latest = latestForGate(evidence, definition.gateId);
  if (!latest) {
    return {
      status: definition.defaultStatus,
      evidenceReference: null,
      expiration: null,
      lastValidated: null,
    };
  }
  if (latest.expiresAtUtc && latest.expiresAtUtc <= nowUtc) {
    return {
      status: 'EXPIRED',
      evidenceReference: latest.reference,
      expiration: latest.expiresAtUtc,
      lastValidated: latest.lastValidatedUtc,
    };
  }
  if (latest.verified && latest.sourceKind === 'EXTERNAL_REGISTERED' && !latest.fixture) {
    return {
      status: 'VERIFIED',
      evidenceReference: latest.reference,
      expiration: latest.expiresAtUtc,
      lastValidated: latest.lastValidatedUtc,
    };
  }
  return {
    status: 'PRESENT_UNVERIFIED',
    evidenceReference: latest.reference,
    expiration: latest.expiresAtUtc,
    lastValidated: latest.lastValidatedUtc,
  };
}

function materialize(
  definition: GateDefinition,
  evidence: EvidenceStore,
  nowUtc: string,
): ExternalInputRecord {
  const derived = statusFor(definition, evidence, nowUtc);
  return Object.freeze({
    gateId: definition.gateId,
    category: definition.category,
    description: definition.description,
    requiredFor: definition.requiredFor,
    jurisdiction: definition.jurisdiction,
    status: derived.status,
    evidenceReference: derived.evidenceReference,
    ownerRole: definition.ownerRole,
    expiration: derived.expiration,
    lastValidated: derived.lastValidated,
    notes: definition.notes,
    kind: definition.kind,
    counselState: definition.counselState,
    exceptionEligible: definition.exceptionEligible,
    selfCertificationForbidden: definition.selfCertificationForbidden,
    satisfiableByInternalTests: definition.satisfiableByInternalTests,
    parentGateId: definition.parentGateId,
    providerFamily: definition.providerFamily,
    providerSlot: definition.providerSlot,
  });
}

function requiredFor(row: ExternalInputRecord, scope: RequiredFor): boolean {
  return row.requiredFor.includes(scope);
}

function satisfied(row: ExternalInputRecord, exceptions: ExceptionStore, nowUtc: string): boolean {
  if (row.status === 'VERIFIED' || row.status === 'NOT_APPLICABLE') {
    return true;
  }
  return activeExceptionFor(exceptions, row.gateId, nowUtc) !== undefined && row.exceptionEligible;
}

function blockersFor(
  rows: readonly ExternalInputRecord[],
  exceptions: ExceptionStore,
  nowUtc: string,
  scope: RequiredFor,
): readonly string[] {
  return Object.freeze(
    rows
      .filter((row) => requiredFor(row, scope) && !satisfied(row, exceptions, nowUtc) && isBlockingStatus(row.status))
      .map((row) => row.gateId),
  );
}

function decide(input: {
  readonly productionBlockers: readonly string[];
  readonly limitedLiveBlockers: readonly string[];
  readonly exceptionsUsed: number;
}): ReleaseDecision {
  if (input.productionBlockers.length === 0 && input.limitedLiveBlockers.length === 0) {
    return input.exceptionsUsed > 0 ? 'CONDITIONAL' : 'READY_FOR_PRODUCTION';
  }
  if (input.limitedLiveBlockers.length === 0) {
    return input.exceptionsUsed > 0 ? 'CONDITIONAL' : 'READY_FOR_LIMITED_LIVE';
  }
  return 'BLOCKED';
}

export function evaluateProductionGates(
  nowUtc = PRODUCTION_GATE_NOW_UTC,
  stores: EvaluationStores = {},
): ProductionGateSnapshot {
  const evidence = stores.evidence ?? createEvidenceStore();
  const exceptions = stores.exceptions ?? createExceptionStore();
  const inputs = Object.freeze(PRODUCTION_GATE_CATALOG.map((row) => materialize(row, evidence, nowUtc)));
  const satisfiedInternal = Object.freeze(
    inputs.filter((row) => row.kind === 'INTERNAL_SOFTWARE' && row.status === 'VERIFIED').map((row) => row.gateId),
  );
  const missingExternal = Object.freeze(
    inputs
      .filter((row) => isExternalKind(row.kind) && (row.status === 'MISSING' || row.status === 'IN_PROGRESS'))
      .map((row) => row.gateId),
  );
  const expired = Object.freeze(inputs.filter((row) => row.status === 'EXPIRED').map((row) => row.gateId));
  const unverified = Object.freeze(
    inputs.filter((row) => row.status === 'PRESENT_UNVERIFIED').map((row) => row.gateId),
  );
  const productionBlockers = blockersFor(inputs, exceptions, nowUtc, 'PRODUCTION');
  const limitedLiveBlockers = blockersFor(inputs, exceptions, nowUtc, 'LIMITED_LIVE');
  const mainnetBlockers = blockersFor(inputs, exceptions, nowUtc, 'MAINNET');
  const exchangeBlockers = blockersFor(inputs, exceptions, nowUtc, 'EXCHANGE');
  const exceptionList = Object.freeze([...exceptions.records.values()]);
  const releaseDecision = decide({
    productionBlockers,
    limitedLiveBlockers,
    exceptionsUsed: exceptionList.length,
  });
  const backendSoftwareReady = inputs
    .filter((row) => row.requiredFor.includes('BACKEND_SOFTWARE'))
    .every((row) => row.status === 'VERIFIED' || row.status === 'NOT_APPLICABLE');
  const externalGatesMissing = missingExternal.length > 0 || expired.length > 0 || unverified.length > 0;

  const registryBody = {
    schemaVersion: PRODUCTION_GATE_SCHEMA_VERSION,
    registryId: PRODUCTION_GATE_REGISTRY_ID,
    evaluatedAtUtc: nowUtc,
    inputs,
  };
  const decisionBody = {
    releaseDecision,
    productionBlockers,
    limitedLiveBlockers,
    mainnetBlockers,
    exchangeBlockers,
    productionActive: false,
    productionReady: false,
  };

  return Object.freeze({
    schemaVersion: PRODUCTION_GATE_SCHEMA_VERSION,
    registryId: PRODUCTION_GATE_REGISTRY_ID,
    toolVersion: PRODUCTION_GATE_TOOL_VERSION,
    evaluatedAtUtc: nowUtc,
    failClosed: true,
    productionActive: false,
    productionReady: false,
    liveConnectivityEnabled: false,
    backendSoftwareReady,
    externalGatesMissing,
    releaseDecision,
    registryHash: hashCanonical(registryBody),
    decisionHash: hashCanonical(decisionBody),
    inputs,
    satisfiedInternalGateIds: satisfiedInternal,
    missingExternalGateIds: missingExternal,
    expiredGateIds: expired,
    unverifiedGateIds: unverified,
    blockers: Object.freeze([...new Set([...productionBlockers, ...limitedLiveBlockers, ...mainnetBlockers, ...exchangeBlockers])]),
    limitedLiveBlockers,
    exceptions: exceptionList,
    ceremonyPrepared: true,
    ceremonyExecuted: false,
  });
}

export function currentRepositoryGateSnapshot(nowUtc = PRODUCTION_GATE_NOW_UTC): ProductionGateSnapshot {
  return evaluateProductionGates(nowUtc);
}

export function gatesByPrefix(snapshot: ProductionGateSnapshot, prefix: string): readonly ExternalInputRecord[] {
  return Object.freeze(snapshot.inputs.filter((row) => row.gateId.startsWith(prefix)));
}

export function countByCategory(snapshot: ProductionGateSnapshot): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const row of snapshot.inputs) {
    counts[row.category] = (counts[row.category] ?? 0) + 1;
  }
  return Object.freeze(counts);
}
