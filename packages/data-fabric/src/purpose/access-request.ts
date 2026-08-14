import { err, ok, type Result } from '@solstice/domain';
import {
  isDataPurpose,
  isLegalBasis,
  isPersonalDataCategory,
  type DataPurpose,
  type LegalBasis,
  type PersonalDataCategory,
} from '@solstice/kernel';

export const ACCESS_REQUEST_FIELDS = [
  'requester',
  'dataCategories',
  'purpose',
  'jurisdiction',
  'duration',
  'legalBasis',
] as const;

export type AccessRequestField = (typeof ACCESS_REQUEST_FIELDS)[number];

export type Requester = {
  readonly id: string;
  readonly kind: 'BUYER' | 'CUSTOMER' | 'OPERATOR' | 'SYSTEM' | 'AGENT';
  readonly sessionId: string;
};

export type AccessDuration = {
  readonly start: string;
  readonly end: string;
};

export type AccessRequest = {
  readonly requester: Requester;
  readonly dataCategories: readonly PersonalDataCategory[];
  readonly purpose: DataPurpose;
  readonly jurisdiction: string;
  readonly duration: AccessDuration;
  readonly legalBasis: LegalBasis;
};

export type AccessRequestRejection = {
  readonly code: 'INCOMPLETE_ACCESS_REQUEST' | 'CROSS_CATEGORY_REQUEST';
  readonly missingFields: readonly AccessRequestField[];
  readonly reasons: readonly string[];
};

/**
 * Parse an access request. Missing fields are rejected — never defaulted,
 * inferred, or auto-populated.
 */
export function parseAccessRequest(input: unknown): Result<AccessRequest, AccessRequestRejection> {
  if (input === null || typeof input !== 'object') {
    return err({
      code: 'INCOMPLETE_ACCESS_REQUEST',
      missingFields: ACCESS_REQUEST_FIELDS,
      reasons: Object.freeze(['access request is not an object']),
    });
  }
  const raw = input as Record<string, unknown>;
  const missing: AccessRequestField[] = [];
  const reasons: string[] = [];

  if (!isPresent(raw.requester)) {
    missing.push('requester');
    reasons.push('missing field: requester');
  }
  if (!isPresent(raw.dataCategories)) {
    missing.push('dataCategories');
    reasons.push('missing field: dataCategories');
  }
  if (!isPresent(raw.purpose)) {
    missing.push('purpose');
    reasons.push('missing field: purpose');
  }
  if (!isPresent(raw.jurisdiction)) {
    missing.push('jurisdiction');
    reasons.push('missing field: jurisdiction');
  }
  if (!isPresent(raw.duration)) {
    missing.push('duration');
    reasons.push('missing field: duration');
  }
  if (!isPresent(raw.legalBasis)) {
    missing.push('legalBasis');
    reasons.push('missing field: legalBasis');
  }

  if (missing.length > 0) {
    return err({
      code: 'INCOMPLETE_ACCESS_REQUEST',
      missingFields: Object.freeze(missing),
      reasons: Object.freeze(reasons),
    });
  }

  const requesterRaw = raw.requester as Record<string, unknown>;
  if (
    requesterRaw === null ||
    typeof requesterRaw !== 'object' ||
    typeof requesterRaw.id !== 'string' ||
    requesterRaw.id.length === 0 ||
    typeof requesterRaw.kind !== 'string' ||
    typeof requesterRaw.sessionId !== 'string' ||
    requesterRaw.sessionId.length === 0
  ) {
    return err({
      code: 'INCOMPLETE_ACCESS_REQUEST',
      missingFields: Object.freeze(['requester'] as AccessRequestField[]),
      reasons: Object.freeze(['requester must declare id, kind, and sessionId — none are defaulted']),
    });
  }

  if (!Array.isArray(raw.dataCategories)) {
    return err({
      code: 'INCOMPLETE_ACCESS_REQUEST',
      missingFields: Object.freeze(['dataCategories'] as AccessRequestField[]),
      reasons: Object.freeze(['dataCategories must be an array']),
    });
  }
  if (raw.dataCategories.length !== 1) {
    return err({
      code: 'CROSS_CATEGORY_REQUEST',
      missingFields: Object.freeze([] as AccessRequestField[]),
      reasons: Object.freeze([
        'a single request cannot span data categories; reading two categories requires two independently authorized requests',
      ]),
    });
  }
  const category = raw.dataCategories[0];
  if (!isPersonalDataCategory(category)) {
    return err({
      code: 'INCOMPLETE_ACCESS_REQUEST',
      missingFields: Object.freeze(['dataCategories'] as AccessRequestField[]),
      reasons: Object.freeze(['dataCategories[0] is not a known personal data category']),
    });
  }
  if (!isDataPurpose(raw.purpose)) {
    return err({
      code: 'INCOMPLETE_ACCESS_REQUEST',
      missingFields: Object.freeze(['purpose'] as AccessRequestField[]),
      reasons: Object.freeze(['purpose is not a known data purpose — it is never inferred']),
    });
  }
  if (typeof raw.jurisdiction !== 'string' || raw.jurisdiction.length === 0) {
    return err({
      code: 'INCOMPLETE_ACCESS_REQUEST',
      missingFields: Object.freeze(['jurisdiction'] as AccessRequestField[]),
      reasons: Object.freeze(['jurisdiction must be a non-empty string']),
    });
  }
  const durationRaw = raw.duration as Record<string, unknown>;
  if (
    durationRaw === null ||
    typeof durationRaw !== 'object' ||
    typeof durationRaw.start !== 'string' ||
    durationRaw.start.length === 0 ||
    typeof durationRaw.end !== 'string' ||
    durationRaw.end.length === 0
  ) {
    return err({
      code: 'INCOMPLETE_ACCESS_REQUEST',
      missingFields: Object.freeze(['duration'] as AccessRequestField[]),
      reasons: Object.freeze(['duration must declare start and end — neither is defaulted']),
    });
  }
  if (!isLegalBasis(raw.legalBasis)) {
    return err({
      code: 'INCOMPLETE_ACCESS_REQUEST',
      missingFields: Object.freeze(['legalBasis'] as AccessRequestField[]),
      reasons: Object.freeze(['legalBasis is not a known legal basis — it is never inferred']),
    });
  }

  return ok(
    Object.freeze({
      requester: Object.freeze({
        id: requesterRaw.id,
        kind: requesterRaw.kind as Requester['kind'],
        sessionId: requesterRaw.sessionId,
      }),
      dataCategories: Object.freeze([category]),
      purpose: raw.purpose,
      jurisdiction: raw.jurisdiction,
      duration: Object.freeze({
        start: durationRaw.start,
        end: durationRaw.end,
      }),
      legalBasis: raw.legalBasis,
    }),
  );
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null;
}
