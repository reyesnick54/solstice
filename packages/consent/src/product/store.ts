import type {
  AccessAuditRecord,
  ConsentGrantView,
  DataRightsRequest,
  DelegationRecord,
  HinParticipationRecord,
  LicenseGrant,
} from './types.ts';

export class DataRightsStore {
  readonly grants = new Map<string, ConsentGrantView>();
  readonly requests = new Map<string, DataRightsRequest>();
  readonly hin = new Map<string, HinParticipationRecord>();
  readonly licenses = new Map<string, LicenseGrant>();
  readonly delegations = new Map<string, DelegationRecord>();
  readonly audit: AccessAuditRecord[] = [];
  readonly grantIdempotency = new Map<string, string>();
  readonly requestIdempotency = new Map<string, string>();
  readonly revokedPermits = new Set<string>();

  grantsForSubject(subjectId: string): readonly ConsentGrantView[] {
    return Object.freeze([...this.grants.values()].filter((row) => row.subjectId === subjectId));
  }

  requestsForSubject(subjectId: string): readonly DataRightsRequest[] {
    return Object.freeze([...this.requests.values()].filter((row) => row.subjectId === subjectId));
  }

  licensesForSubject(subjectId: string): readonly LicenseGrant[] {
    return Object.freeze([...this.licenses.values()].filter((row) => row.subjectId === subjectId));
  }

  delegationsForSubject(subjectId: string): readonly DelegationRecord[] {
    return Object.freeze([...this.delegations.values()].filter((row) => row.subjectId === subjectId));
  }

  auditForSubject(subjectId: string): readonly AccessAuditRecord[] {
    return Object.freeze(this.audit.filter((row) => row.subjectId === subjectId));
  }
}
