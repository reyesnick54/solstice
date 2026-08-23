import { catalogById } from './catalog.ts';
import { hashCanonical } from './hash.ts';
import {
  OVERRIDE_FORBIDDEN_KINDS,
  gateErr,
  gateOk,
  type GateActorKind,
  type GateExceptionRecord,
  type OwnerRole,
  type ProductionGateResult,
} from './types.ts';

export const NEVER_EXCEPTIONABLE_GATES = Object.freeze([
  'sec.external-architecture-review',
  'sec.external-pentest',
  'sec.protocol-chain-audit',
  'sec.exchange-review',
  'sec.cryptography-review',
  'sec.hsm-kms',
  'sec.key-ceremony-readiness',
  'chain.economic-parameters',
  'chain.native-asset-parameters',
  'chain.final-genesis',
  'chain.mainnet-activation-approval',
  'chain.protocol-audit',
  'chain.hsm-kms',
  'ex.security-review',
]);

const GOVERNANCE_ROLES = new Set<OwnerRole>(['GOVERNANCE_ADMIN', 'HUMAN_GOVERNANCE']);

export type ExceptionStore = {
  records: Map<string, GateExceptionRecord>;
};

export function createExceptionStore(): ExceptionStore {
  return { records: new Map() };
}

export function authorizeException(
  store: ExceptionStore,
  input: {
    readonly exceptionId: string;
    readonly gateId: string;
    readonly actorKind: GateActorKind;
    readonly actorRole: OwnerRole;
    readonly actorId: string;
    readonly reason: string;
    readonly approvedAtUtc: string;
    readonly expiresAtUtc: string;
  },
): ProductionGateResult<GateExceptionRecord> {
  const definition = catalogById().get(input.gateId);
  if (!definition) {
    return gateErr('UNKNOWN_GATE', `gate ${input.gateId} is not in the External Input Registry`);
  }
  if ((OVERRIDE_FORBIDDEN_KINDS as readonly string[]).includes(input.actorKind)) {
    return gateErr(
      'OVERRIDE_FORBIDDEN',
      `${input.actorKind} cannot authorize a production-gate exception`,
    );
  }
  if (input.actorKind !== 'HUMAN' || !GOVERNANCE_ROLES.has(input.actorRole)) {
    return gateErr(
      'GOVERNANCE_REQUIRED',
      'only a human GOVERNANCE_ADMIN or HUMAN_GOVERNANCE actor may authorize an exception',
    );
  }
  if (!definition.exceptionEligible || NEVER_EXCEPTIONABLE_GATES.includes(input.gateId)) {
    return gateErr(
      'EXCEPTION_NOT_ELIGIBLE',
      `gate ${input.gateId} cannot be waived; missing required evidence still fails closed`,
    );
  }
  if (input.reason.trim().length < 16) {
    return gateErr('REASON_REQUIRED', 'exception reason must be documented for audit');
  }
  if (input.expiresAtUtc <= input.approvedAtUtc) {
    return gateErr('EXCEPTION_EXPIRY_INVALID', 'exception must have a future expiration');
  }
  if (store.records.has(input.exceptionId)) {
    return gateErr('DUPLICATE_EXCEPTION', `exception ${input.exceptionId} already exists`);
  }

  const draft = {
    exceptionId: input.exceptionId,
    gateId: input.gateId,
    actorKind: input.actorKind,
    actorRole: input.actorRole,
    actorId: input.actorId,
    reason: input.reason,
    approvedAtUtc: input.approvedAtUtc,
    expiresAtUtc: input.expiresAtUtc,
    auditable: true as const,
  };
  const record: GateExceptionRecord = Object.freeze({
    ...draft,
    exceptionHash: hashCanonical(draft),
  });
  store.records.set(record.exceptionId, record);
  return gateOk(record);
}

export function activeExceptionFor(
  store: ExceptionStore,
  gateId: string,
  nowUtc: string,
): GateExceptionRecord | undefined {
  for (const record of store.records.values()) {
    if (record.gateId === gateId && record.expiresAtUtc > nowUtc) {
      return record;
    }
  }
  return undefined;
}
