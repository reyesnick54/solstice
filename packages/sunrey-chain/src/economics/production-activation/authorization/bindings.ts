import { encodeBool, encodeString, sha256Hex } from '../../../validators/canonical.ts';
import { currentExternalEvidenceInventory as constitutionEvidence } from '../../../release-candidate/economic/production-constitution/limitations.ts';
import { currentExternalEvidenceInventory as platformEvidence } from '../../../production-handoff/full-platform-candidate/limitations.ts';

import { hashOrderedStrings } from './hash.ts';
import {
  OPERATING_SCOPE_DOMAINS,
  PROVIDER_BINDING_DOMAINS,
  REQUIRED_EXTERNAL_EVIDENCE_CLASSES,
  type ExternalEvidenceBinding,
  type ExternalEvidenceSlot,
  type OperatingScopeBinding,
  type OperatingScopeRow,
  type ProviderBindingDomain,
  type ProviderBindingMatrix,
  type ProviderBindingRow,
  type RequiredExternalEvidenceClass,
} from './types.ts';

const EVIDENCE_DOMAIN = 'SUNREY_PRODUCTION_AUTHORIZATION_EXTERNAL_EVIDENCE_V1' as const;
const SCOPE_DOMAIN = 'SUNREY_PRODUCTION_AUTHORIZATION_OPERATING_SCOPE_V1' as const;
const PROVIDER_DOMAIN = 'SUNREY_PRODUCTION_AUTHORIZATION_PROVIDER_MATRIX_V1' as const;

const CURRENT_SLOT_NOTES: Record<RequiredExternalEvidenceClass, string> = {
  SECURITY_AUDIT: 'independent security audit not supplied',
  COUNSEL_OPINION: 'no counsel opinion is recorded',
  LICENSE: 'no license or registration evidence is recorded',
  REGULATORY_APPROVAL: 'no regulatory approval is recorded',
  PROVIDER_CONTRACT: 'no real provider contract is recorded',
  HSM_ATTESTATION: 'simulation HSM is not production attestation',
};

export function currentExternalEvidenceSlots(
  overlays: Partial<Record<RequiredExternalEvidenceClass, Partial<ExternalEvidenceSlot>>> = {},
): readonly ExternalEvidenceSlot[] {
  void constitutionEvidence;
  void platformEvidence;
  return Object.freeze(
    REQUIRED_EXTERNAL_EVIDENCE_CLASSES.map((evidenceClass) =>
      Object.freeze({
        present: false,
        revoked: false,
        expiresAtUtc: null,
        contentHash: null,
        fixture: false,
        ...overlays[evidenceClass],
        evidenceClass,
      }),
    ),
  );
}

export function bindExternalEvidence(
  slots: readonly ExternalEvidenceSlot[],
  nowUtc: string,
): ExternalEvidenceBinding {
  const expired = slots.some(
    (slot) => slot.present && slot.expiresAtUtc !== null && nowUtc > slot.expiresAtUtc,
  );
  const revoked = slots.some((slot) => slot.revoked);
  const allRequiredPresent = REQUIRED_EXTERNAL_EVIDENCE_CLASSES.every((evidenceClass) => {
    const slot = slots.find((row) => row.evidenceClass === evidenceClass);
    return slot?.present === true && !slot.revoked && (slot.expiresAtUtc === null || nowUtc <= slot.expiresAtUtc);
  });
  return Object.freeze({
    bundleHash: hashEvidenceSlots(slots),
    slots: Object.freeze([...slots]),
    allRequiredPresent,
    stale: expired || revoked || !allRequiredPresent,
    expired,
    revoked,
  });
}

export function hashEvidenceSlots(slots: readonly ExternalEvidenceSlot[]): string {
  const ordered = [...slots].sort((left, right) => (left.evidenceClass < right.evidenceClass ? -1 : 1));
  return sha256Hex(
    Buffer.concat([
      encodeString(EVIDENCE_DOMAIN),
      ...ordered.flatMap((slot) => [
        encodeString(slot.evidenceClass),
        encodeBool(slot.present),
        encodeBool(slot.revoked),
        encodeString(slot.expiresAtUtc ?? ''),
        encodeString(slot.contentHash ?? ''),
        encodeBool(slot.fixture),
      ]),
    ]),
  );
}

export function currentOperatingScopeBinding(): OperatingScopeBinding {
  const rows: readonly OperatingScopeRow[] = Object.freeze(
    OPERATING_SCOPE_DOMAINS.map((domain) =>
      Object.freeze({
        domain,
        kind: domain === 'NATIVE_PROTOCOL_ECONOMICS' ? ('NATIVE_PROTOCOL' as const) : ('REGULATED_SERVICE' as const),
        bound: true,
        activatedByGlobalEconomicPackage: false as const,
      }),
    ),
  );
  return Object.freeze({
    matrixHash: hashOrderedStrings(
      SCOPE_DOMAIN,
      rows.map((row) => `${row.domain}:${row.kind}:${String(row.bound)}:false`),
    ),
    rows,
    nativeProtocolSeparatedFromRegulatedServices: true,
    globalPackageActivatesRegulatedProducts: false,
  });
}

export function currentProviderBindingMatrix(
  overlays: Partial<Record<ProviderBindingDomain, Partial<ProviderBindingRow>>> = {},
): ProviderBindingMatrix {
  const rows = Object.freeze(
    PROVIDER_BINDING_DOMAINS.map((domain) => {
      const relatedToNativeProtocol = domain === 'NATIVE_PROTOCOL' || domain === 'ORACLE';
      const overlay = overlays[domain] ?? {};
      return Object.freeze({
        bound: overlay.bound ?? false,
        relatedToNativeProtocol: overlay.relatedToNativeProtocol ?? relatedToNativeProtocol,
        missingBlocksNativeProtocol: overlay.missingBlocksNativeProtocol ?? false,
        missingBlocksDomain: overlay.missingBlocksDomain ?? domain !== 'NATIVE_PROTOCOL',
        domain,
      });
    }),
  );
  return Object.freeze({
    matrixHash: hashProviderRows(rows),
    rows,
    unrelatedProviderMissingBlocksProtocol: false,
  });
}

export function hashProviderRows(rows: readonly ProviderBindingRow[]): string {
  return hashOrderedStrings(
    PROVIDER_DOMAIN,
    rows.map(
      (row) =>
        `${row.domain}:${String(row.bound)}:${String(row.relatedToNativeProtocol)}:${String(row.missingBlocksNativeProtocol)}:${String(row.missingBlocksDomain)}`,
    ),
  );
}

export function missingProviderBlocksOnlyBoundDomain(
  matrix: ProviderBindingMatrix,
  domain: ProviderBindingDomain,
): boolean {
  const row = matrix.rows.find((item) => item.domain === domain);
  if (!row || row.bound) {
    return false;
  }
  return row.missingBlocksDomain && !row.missingBlocksNativeProtocol;
}

export function currentEvidenceNotes(): readonly string[] {
  return REQUIRED_EXTERNAL_EVIDENCE_CLASSES.map((evidenceClass) => `${evidenceClass}:${CURRENT_SLOT_NOTES[evidenceClass]}`);
}
