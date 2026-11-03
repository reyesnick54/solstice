/**
 * AAF07 — evaluate whether a provider profile is qualified for HELIOS external observation use.
 */

import { AAF07_CERTIFIED_PROVIDER_CATALOG } from './profiles.ts';
import type { Aaf07CertificationVerdict, Aaf07ProviderCertificationRecord } from './types.ts';

function validateRecord(record: Aaf07ProviderCertificationRecord): string[] {
  const blockers: string[] = [];
  if (!record.documentationUrl.startsWith('https://')) {
    blockers.push(`${record.providerId}: documentation URL missing or invalid`);
  }
  if (!record.accessTermsUrl.startsWith('https://')) {
    blockers.push(`${record.providerId}: access terms URL missing or invalid`);
  }
  if (record.commercialUseStatus === 'PROHIBITED' || record.commercialUseStatus === 'UNKNOWN') {
    blockers.push(`${record.providerId}: commercial use not cleared (${record.commercialUseStatus})`);
  }
  if (record.timestampSemantics === 'UNKNOWN') {
    blockers.push(`${record.providerId}: timestamp semantics unknown`);
  }
  if (!record.rateLimits.burstNotes?.trim()) {
    blockers.push(`${record.providerId}: rate limit notes missing`);
  }
  return blockers;
}

export function certifyAaf07Provider(providerId: string): Aaf07CertificationVerdict {
  const record = AAF07_CERTIFIED_PROVIDER_CATALOG[providerId] ?? null;
  if (!record) {
    return Object.freeze({
      providerId,
      certified: false,
      blockers: Object.freeze([`provider ${providerId} has no AAF07 certification profile`]),
      record: null,
      grantsExecutionAuthority: false,
    });
  }
  const blockers = validateRecord(record);
  return Object.freeze({
    providerId,
    certified: blockers.length === 0,
    blockers: Object.freeze(blockers),
    record,
    grantsExecutionAuthority: false,
  });
}

export function requireAaf07Certification(
  providerId: string,
): { readonly ok: true; readonly record: Aaf07ProviderCertificationRecord } | { readonly ok: false; readonly verdict: Aaf07CertificationVerdict } {
  const verdict = certifyAaf07Provider(providerId);
  if (!verdict.certified || !verdict.record) {
    return { ok: false, verdict };
  }
  return { ok: true, record: verdict.record };
}
