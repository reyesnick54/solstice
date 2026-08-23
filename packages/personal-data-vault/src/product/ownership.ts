/**
 * Distinct rights and roles. SunRey does not own all user data.
 */

export const OWNERSHIP_ROLES = [
  'DATA_SUBJECT',
  'DATA_CONTROLLER',
  'DATA_SOURCE',
  'RIGHTS_HOLDER',
  'LICENSEE',
] as const;
export type OwnershipRole = (typeof OWNERSHIP_ROLES)[number];

export type VaultOwnership = {
  readonly dataSubjectId: string;
  readonly controllerRole: 'SUNREY_SERVICE';
  readonly controllerDoesNotOwnData: true;
  readonly sourceId: string;
  readonly rightsHolderId: string;
  readonly licenseeId: string | null;
};

export const SUNREY_DOES_NOT_OWN_USER_DATA = true as const;

export function ownershipForSubject(input: {
  readonly subjectId: string;
  readonly sourceId: string;
  readonly rightsHolderId?: string;
  readonly licenseeId?: string | null;
}): VaultOwnership {
  return Object.freeze({
    dataSubjectId: input.subjectId,
    controllerRole: 'SUNREY_SERVICE',
    controllerDoesNotOwnData: true,
    sourceId: input.sourceId,
    rightsHolderId: input.rightsHolderId ?? input.subjectId,
    licenseeId: input.licenseeId ?? null,
  });
}
