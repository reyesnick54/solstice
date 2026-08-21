import { randomUUID } from 'node:crypto';

import { createFinding } from './findings.ts';
import type { ComplianceAdapterStore } from './store.ts';
import type { AmlProviderResult, AmlSignal, ComplianceAdapterProfile } from './types.ts';

export type AmlProviderPort = {
  submitSignal(signal: AmlSignal): AmlProviderResult;
  retrieveSignal(signalId: string): AmlProviderResult | undefined;
};

export class AmlAdapter implements AmlProviderPort {
  private readonly results = new Map<string, AmlProviderResult>();

  constructor(
    private readonly store: ComplianceAdapterStore,
    private readonly profile: ComplianceAdapterProfile,
    private readonly alertFor: (subjectRef: string) => boolean,
  ) {}

  submitSignal(signal: AmlSignal): AmlProviderResult {
    const existing = this.results.get(signal.signalId);
    if (existing || this.store.signals.has(signal.signalId)) {
      const duplicate = existing ?? this.rebuildDuplicate(signal);
      return Object.freeze({ ...duplicate, duplicate: true });
    }
    this.store.signals.add(signal.signalId);
    const alert = this.alertFor(signal.subjectRef);
    const finding = createFinding({
      kind: 'AML',
      subjectKind: 'PERSON',
      subjectRef: signal.subjectRef,
      providerId: this.profile.providerId,
      matchState: alert ? 'REQUIRES_REVIEW' : 'NO_MATCH',
      severity: alert ? 'HIGH' : 'INFO',
      reasonCodes: Object.freeze(alert ? ['AML_ALERT', `SOURCE_${signal.source}`] : ['AML_CLEAR', `SOURCE_${signal.source}`]),
      now: signal.now,
    });
    this.store.findings.set(finding.findingId, finding);
    const result: AmlProviderResult = Object.freeze({
      signalId: signal.signalId,
      alert,
      finding,
      duplicate: false,
    });
    this.results.set(signal.signalId, result);
    return result;
  }

  retrieveSignal(signalId: string): AmlProviderResult | undefined {
    return this.results.get(signalId);
  }

  private rebuildDuplicate(signal: AmlSignal): AmlProviderResult {
    const finding = createFinding({
      kind: 'AML',
      subjectKind: 'PERSON',
      subjectRef: signal.subjectRef,
      providerId: this.profile.providerId,
      matchState: 'NO_MATCH',
      severity: 'INFO',
      reasonCodes: Object.freeze(['AML_DUPLICATE_EVENT']),
      now: signal.now,
    });
    return Object.freeze({
      signalId: signal.signalId.length > 0 ? signal.signalId : `aml_${randomUUID()}`,
      alert: false,
      finding,
      duplicate: true,
    });
  }
}
