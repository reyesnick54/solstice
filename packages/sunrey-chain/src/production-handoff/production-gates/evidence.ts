import { catalogById } from './catalog.ts';
import { hashCanonical } from './hash.ts';
import {
  gateErr,
  gateOk,
  type GateActorKind,
  type GateEvidenceRecord,
  type ProductionGateResult,
} from './types.ts';

export type EvidenceStore = {
  records: Map<string, GateEvidenceRecord>;
};

export function createEvidenceStore(): EvidenceStore {
  return { records: new Map() };
}

export type AttachEvidenceInput = {
  readonly evidenceId: string;
  readonly gateId: string;
  readonly sourceKind: GateEvidenceRecord['sourceKind'];
  readonly reference: string;
  readonly contentDigest: string;
  readonly attachedAtUtc: string;
  readonly expiresAtUtc?: string | null;
  readonly lastValidatedUtc?: string | null;
  readonly fixture?: boolean;
  readonly notes?: string;
  readonly actorKind?: GateActorKind;
};

const EXTERNAL_AUDIT_GATES = new Set([
  'sec.external-architecture-review',
  'sec.external-pentest',
  'sec.protocol-chain-audit',
  'sec.exchange-review',
  'sec.cryptography-review',
  'sec.critical-findings-remediated',
  'sec.dependency-baseline',
  'chain.protocol-audit',
  'ex.security-review',
  'ai.prompt-injection-suite',
  'ai.red-team-result',
]);

export function attachEvidence(
  store: EvidenceStore,
  input: AttachEvidenceInput,
): ProductionGateResult<GateEvidenceRecord> {
  const definition = catalogById().get(input.gateId);
  if (!definition) {
    return gateErr('UNKNOWN_GATE', `gate ${input.gateId} is not in the External Input Registry`);
  }
  if (store.records.has(input.evidenceId)) {
    return gateErr('DUPLICATE_EVIDENCE', `evidence ${input.evidenceId} already exists`);
  }
  if (input.reference.length === 0 && input.contentDigest.length === 0) {
    return gateErr('REFERENCE_REQUIRED', 'evidence reference or content digest is required');
  }

  const internalSource =
    input.sourceKind === 'INTERNAL_TEST' || input.sourceKind === 'FIXTURE' || input.sourceKind === 'ENGINEERING_NOTE';
  if (definition.selfCertificationForbidden && internalSource) {
    return gateErr(
      'SELF_CERTIFICATION_FORBIDDEN',
      `internal or fixture evidence cannot satisfy ${input.gateId}; external evidence must be explicitly registered`,
    );
  }
  if (EXTERNAL_AUDIT_GATES.has(input.gateId) && input.sourceKind !== 'EXTERNAL_REGISTERED') {
    return gateErr(
      'EXTERNAL_AUDIT_REQUIRED',
      `${input.gateId} cannot become complete from internal tests or fixtures`,
    );
  }
  if (input.actorKind && input.actorKind !== 'HUMAN' && definition.selfCertificationForbidden) {
    return gateErr('NON_HUMAN_EVIDENCE_REJECTED', `${input.actorKind} cannot attach external gate evidence`);
  }

  const previous = latestForGate(store, input.gateId);
  const record: GateEvidenceRecord = Object.freeze({
    evidenceId: input.evidenceId,
    gateId: input.gateId,
    version: previous ? previous.version + 1 : 1,
    previousVersionId: previous?.evidenceId ?? null,
    sourceKind: input.sourceKind,
    reference: input.reference,
    contentDigest: input.contentDigest,
    attachedAtUtc: input.attachedAtUtc,
    expiresAtUtc: input.expiresAtUtc ?? null,
    lastValidatedUtc: input.lastValidatedUtc ?? null,
    verified: false,
    fixture: input.fixture === true,
    notes: input.notes ?? '',
  });
  store.records.set(record.evidenceId, record);
  return gateOk(record);
}

export function verifyEvidence(
  store: EvidenceStore,
  evidenceId: string,
  actorKind: GateActorKind,
  nowUtc: string,
): ProductionGateResult<GateEvidenceRecord> {
  const current = store.records.get(evidenceId);
  if (!current) {
    return gateErr('NOT_FOUND', `evidence ${evidenceId} is not registered`);
  }
  const definition = catalogById().get(current.gateId);
  if (!definition) {
    return gateErr('UNKNOWN_GATE', `gate ${current.gateId} is missing from catalog`);
  }
  if (actorKind !== 'HUMAN') {
    return gateErr('NON_HUMAN_VERIFIER', `${actorKind} cannot verify gate evidence`);
  }
  if (current.fixture || current.sourceKind !== 'EXTERNAL_REGISTERED') {
    return gateErr('FIXTURE_CANNOT_VERIFY', 'fixture or internal evidence cannot be verified as external');
  }
  if (current.expiresAtUtc && current.expiresAtUtc <= nowUtc) {
    return gateErr('EVIDENCE_EXPIRED', `evidence ${evidenceId} is expired`);
  }
  const next = Object.freeze({
    ...current,
    verified: true,
    lastValidatedUtc: nowUtc,
  });
  store.records.set(evidenceId, next);
  return gateOk(next);
}

export function latestForGate(store: EvidenceStore, gateId: string): GateEvidenceRecord | undefined {
  let latest: GateEvidenceRecord | undefined;
  for (const record of store.records.values()) {
    if (record.gateId !== gateId) {
      continue;
    }
    if (!latest || record.version > latest.version) {
      latest = record;
    }
  }
  return latest;
}

export function evidenceDigest(record: GateEvidenceRecord): string {
  return hashCanonical(record);
}

export function isExternalPentestComplete(store: EvidenceStore, nowUtc: string): boolean {
  const latest = latestForGate(store, 'sec.external-pentest');
  if (!latest) {
    return false;
  }
  if (latest.sourceKind !== 'EXTERNAL_REGISTERED' || latest.fixture || !latest.verified) {
    return false;
  }
  if (latest.expiresAtUtc && latest.expiresAtUtc <= nowUtc) {
    return false;
  }
  return true;
}

export function deriveExternalCompleteLabel(gateId: string, store: EvidenceStore, nowUtc: string): boolean {
  const latest = latestForGate(store, gateId);
  const definition = catalogById().get(gateId);
  if (!latest || !definition || definition.kind !== 'EXTERNAL_AUDIT') {
    return false;
  }
  return (
    latest.sourceKind === 'EXTERNAL_REGISTERED' &&
    latest.verified &&
    !latest.fixture &&
    (latest.expiresAtUtc === null || latest.expiresAtUtc > nowUtc)
  );
}
