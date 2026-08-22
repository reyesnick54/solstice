import type { NormalizedComplianceFinding } from './types.ts';

export type ComplianceAdapterSnapshot = {
  readonly findings: readonly NormalizedComplianceFinding[];
  readonly signals: readonly string[];
  readonly webhookKeys: readonly string[];
  readonly scheduledJobs: readonly {
    readonly jobId: string;
    readonly jobType: string;
    readonly subjectRef: string;
    readonly trigger: string;
  }[];
};

export class ComplianceAdapterStore {
  readonly findings = new Map<string, NormalizedComplianceFinding>();
  readonly signals = new Set<string>();
  readonly webhookKeys = new Set<string>();
  readonly scheduledJobs = new Map<
    string,
    { readonly jobId: string; readonly jobType: string; readonly subjectRef: string; readonly trigger: string }
  >();

  snapshot(): ComplianceAdapterSnapshot {
    return Object.freeze({
      findings: Object.freeze([...this.findings.values()]),
      signals: Object.freeze([...this.signals]),
      webhookKeys: Object.freeze([...this.webhookKeys]),
      scheduledJobs: Object.freeze([...this.scheduledJobs.values()]),
    });
  }

  hydrate(snapshot: ComplianceAdapterSnapshot): void {
    this.findings.clear();
    this.signals.clear();
    this.webhookKeys.clear();
    this.scheduledJobs.clear();
    for (const finding of snapshot.findings) {
      this.findings.set(finding.findingId, finding);
    }
    for (const signal of snapshot.signals) {
      this.signals.add(signal);
    }
    for (const key of snapshot.webhookKeys) {
      this.webhookKeys.add(key);
    }
    for (const job of snapshot.scheduledJobs) {
      this.scheduledJobs.set(job.jobId, job);
    }
  }

  latest(subjectRef: string, kind: NormalizedComplianceFinding['kind']): NormalizedComplianceFinding | undefined {
    let latest: NormalizedComplianceFinding | undefined;
    for (const finding of this.findings.values()) {
      if (finding.subjectRef !== subjectRef || finding.kind !== kind) {
        continue;
      }
      if (!latest || finding.observedAt > latest.observedAt) {
        latest = finding;
      }
    }
    return latest;
  }
}
