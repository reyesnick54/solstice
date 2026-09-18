import { randomBytes } from 'node:crypto';

export type SupervisoryExportRequestId = `sexp_${string}`;
export type SupervisoryExportPackageId = `spkg_${string}`;
export type RegulatoryChangeRequestId = `rcr_${string}`;
export type PolicyVersionRef = `pver_${string}`;

export function asSupervisoryExportRequestId(value: string): SupervisoryExportRequestId {
  if (!value.startsWith('sexp_')) {
    throw new Error(`invalid supervisory export request id: ${value}`);
  }
  return value as SupervisoryExportRequestId;
}

export function asSupervisoryExportPackageId(value: string): SupervisoryExportPackageId {
  if (!value.startsWith('spkg_')) {
    throw new Error(`invalid supervisory export package id: ${value}`);
  }
  return value as SupervisoryExportPackageId;
}

export function asRegulatoryChangeRequestId(value: string): RegulatoryChangeRequestId {
  if (!value.startsWith('rcr_')) {
    throw new Error(`invalid regulatory change request id: ${value}`);
  }
  return value as RegulatoryChangeRequestId;
}

export function exportRequestIdFor(key: string): SupervisoryExportRequestId {
  return asSupervisoryExportRequestId(`sexp_${key}`);
}

export function exportPackageIdFor(requestId: SupervisoryExportRequestId): SupervisoryExportPackageId {
  return asSupervisoryExportPackageId(`spkg_${requestId.slice(5)}`);
}

export function changeRequestIdFor(key: string): RegulatoryChangeRequestId {
  return asRegulatoryChangeRequestId(`rcr_${key}`);
}

export function policyVersionRefFor(packId: string, version: string): PolicyVersionRef {
  return `pver_${packId}_${version}` as PolicyVersionRef;
}

export function randomSuffix(): string {
  return randomBytes(4).toString('hex');
}
