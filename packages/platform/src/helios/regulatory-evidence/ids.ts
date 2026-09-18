import { createHash } from 'node:crypto';

import type { EconomicWorkOrderId } from '../ids.ts';

export type RegulatoryEvidencePackageId = string & { readonly __brand: 'RegulatoryEvidencePackageId' };
export type ReportingObligationId = string & { readonly __brand: 'ReportingObligationId' };
export type ReportPackageId = string & { readonly __brand: 'ReportPackageId' };
export type RegulatoryTraceId = string & { readonly __brand: 'RegulatoryTraceId' };
export type TriggerEventId = string & { readonly __brand: 'TriggerEventId' };
export type SubmissionRecordId = string & { readonly __brand: 'SubmissionRecordId' };

export function asRegulatoryEvidencePackageId(value: string): RegulatoryEvidencePackageId {
  return value as RegulatoryEvidencePackageId;
}

export function asReportingObligationId(value: string): ReportingObligationId {
  return value as ReportingObligationId;
}

export function asReportPackageId(value: string): ReportPackageId {
  return value as ReportPackageId;
}

export function asRegulatoryTraceId(value: string): RegulatoryTraceId {
  return value as RegulatoryTraceId;
}

export function asTriggerEventId(value: string): TriggerEventId {
  return value as TriggerEventId;
}

export function asSubmissionRecordId(value: string): SubmissionRecordId {
  return value as SubmissionRecordId;
}

export function regulatoryTraceIdFor(workOrderId: EconomicWorkOrderId, actionKey: string): RegulatoryTraceId {
  const digest = createHash('sha256').update(`${workOrderId}:${actionKey}:trace`).digest('hex').slice(0, 24);
  return asRegulatoryTraceId(`hreg_trace_${digest}`);
}

export function evidencePackageIdFor(traceId: RegulatoryTraceId, version: number): RegulatoryEvidencePackageId {
  const digest = createHash('sha256').update(`${traceId}:v${version}`).digest('hex').slice(0, 24);
  return asRegulatoryEvidencePackageId(`hreg_pkg_${digest}`);
}

export function obligationIdFor(triggerEventId: TriggerEventId, policyObligationRef: string): ReportingObligationId {
  const digest = createHash('sha256').update(`${triggerEventId}:${policyObligationRef}`).digest('hex').slice(0, 24);
  return asReportingObligationId(`hreg_obl_${digest}`);
}

export function reportPackageIdFor(obligationId: ReportingObligationId, revision: number): ReportPackageId {
  const digest = createHash('sha256').update(`${obligationId}:r${revision}`).digest('hex').slice(0, 24);
  return asReportPackageId(`hreg_rpt_${digest}`);
}

export function triggerEventIdFor(sourceEventId: string, triggerCategory: string): TriggerEventId {
  const digest = createHash('sha256').update(`${sourceEventId}:${triggerCategory}`).digest('hex').slice(0, 24);
  return asTriggerEventId(`hreg_trig_${digest}`);
}

export function submissionRecordIdFor(reportPackageId: ReportPackageId, attempt: number): SubmissionRecordId {
  const digest = createHash('sha256').update(`${reportPackageId}:sub${attempt}`).digest('hex').slice(0, 24);
  return asSubmissionRecordId(`hreg_sub_${digest}`);
}
