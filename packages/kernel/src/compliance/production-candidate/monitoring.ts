import { randomUUID } from 'node:crypto';

import type { ComplianceAdapterStore } from './store.ts';
import type { ComplianceJobType, MonitoringTrigger } from './types.ts';

/** Phase B job draft shape. Kernel does not import packages/events. */
export type ComplianceJobDraft = {
  readonly jobId: string;
  readonly jobType: string;
  readonly payload: Readonly<Record<string, string>>;
  readonly runAt: string;
};

export const MONITORING_POLICY = Object.freeze({
  continuousExpensiveRescreen: false,
  requiresExplicitTrigger: true,
  usesPhaseBJobs: true,
});

export function scheduleRescreen(input: {
  readonly store: ComplianceAdapterStore;
  readonly trigger: MonitoringTrigger;
  readonly subjectRef: string;
  readonly now: string;
  readonly policyAllows: boolean;
}): ComplianceJobDraft | { readonly ok: false; readonly reasonCode: 'POLICY_FORBIDS_RESCREEN' } {
  if (!input.policyAllows || MONITORING_POLICY.continuousExpensiveRescreen) {
    return { ok: false, reasonCode: 'POLICY_FORBIDS_RESCREEN' };
  }
  const jobType = jobTypeFor(input.trigger);
  const jobId = `job_${randomUUID()}`;
  input.store.scheduledJobs.set(jobId, {
    jobId,
    jobType,
    subjectRef: input.subjectRef,
    trigger: input.trigger,
  });
  return Object.freeze({
    jobId,
    jobType,
    payload: Object.freeze({
      subjectRef: input.subjectRef,
      trigger: input.trigger,
    }),
    runAt: input.now,
  });
}

function jobTypeFor(trigger: MonitoringTrigger): ComplianceJobType {
  switch (trigger) {
    case 'SANCTIONS_LIST_UPDATE':
      return 'SANCTIONS_LIST_UPDATE';
    case 'PEP_STATUS_UPDATE':
      return 'PEP_STATUS_UPDATE';
    case 'KYC_EXPIRY':
      return 'KYC_EXPIRY_CHECK';
    case 'BUSINESS_STATUS':
      return 'BUSINESS_STATUS_UPDATE';
    case 'WALLET_RISK_CHANGE':
      return 'WALLET_RISK_CHANGE';
  }
}
