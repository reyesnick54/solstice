import type { UtcInstant } from '../../../../domain/src/time.ts';
import { createFinding } from './findings.ts';
import type { ComplianceAdapterStore } from './store.ts';
import type {
  ComplianceAdapterProfile,
  NormalizedComplianceFinding,
  ProviderMatchState,
  ScreeningSubject,
} from './types.ts';

export type AdverseMediaScreenInput = {
  readonly subjectKind: ScreeningSubject;
  readonly subjectRef: string;
  readonly now: UtcInstant;
};

export type AdverseMediaProviderPort = {
  screen(input: AdverseMediaScreenInput): NormalizedComplianceFinding;
};

export class AdverseMediaAdapter implements AdverseMediaProviderPort {
  constructor(
    private readonly store: ComplianceAdapterStore,
    private readonly profile: ComplianceAdapterProfile,
    private readonly matchFor: (subjectRef: string) => ProviderMatchState,
  ) {}

  screen(input: AdverseMediaScreenInput): NormalizedComplianceFinding {
    const matchState = this.matchFor(input.subjectRef);
    const finding = createFinding({
      kind: 'ADVERSE_MEDIA',
      subjectKind: input.subjectKind,
      subjectRef: input.subjectRef,
      providerId: this.profile.providerId,
      matchState,
      severity: matchState === 'NO_MATCH' ? 'INFO' : 'MEDIUM',
      reasonCodes: Object.freeze([`ADVERSE_MEDIA_${matchState}`]),
      now: input.now,
    });
    this.store.findings.set(finding.findingId, finding);
    return finding;
  }
}
