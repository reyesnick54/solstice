import type { Clock } from '../../../../config/src/clock.ts';
import type { Jurisdiction } from '../../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import {
  DocumentVerificationAdapter,
  IdentityAdapterStore,
  IdentityAdapterWebhook,
  KybAdapter,
  KycAdapter,
  bindIdentityProviderLifecycle,
  documentAuthenticityFor,
  identityStateForSubject,
  kybStateForBusiness,
  sandboxIdentityProfile,
  toIdentityVerificationClientState,
  type IdentityAdapterSnapshot,
  type IdentityVerificationClientState,
  type IdentityVerificationRecord,
} from '../../../../identity/src/production-candidate/index.ts';
import { escalateFromComplianceFacts, type ComplianceFacts } from '../facts.ts';
import { ComplianceFabric } from '../fabric.ts';
import type { DecisionStatus } from '../../../../permissions/src/decision.ts';
import { AdverseMediaAdapter } from './adverse-media.ts';
import { AmlAdapter } from './aml.ts';
import { openCaseFromFinding, type FindingCaseLink } from './cases.ts';
import { toCustodyComplianceFact, toExchangeComplianceFact } from './eligibility.ts';
import { FraudAdapter } from './fraud.ts';
import { bindComplianceProviderLifecycle } from './lifecycle.ts';
import { scheduleRescreen } from './monitoring.ts';
import { dispositionForOutage, type ProviderOutageDisposition } from './outage.ts';
import { PepAdapter } from './pep.ts';
import {
  adverseMediaMatchFor,
  amlAlertFor,
  fraudActionFor,
  pepMatchFor,
  sandboxComplianceProfile,
  sanctionsMatchFor,
  unavailableComplianceProfile,
} from './sandbox.ts';
import { SanctionsAdapter } from './sanctions.ts';
import { ComplianceAdapterStore, type ComplianceAdapterSnapshot } from './store.ts';
import { COMPLIANCE_ADAPTER_FLAGS, subjectToFabricKind, type AmlSignal, type MonitoringTrigger, type NormalizedComplianceFinding, type ScreeningSubject } from './types.ts';
import { ComplianceAdapterWebhook } from './webhook.ts';

export type ComplianceProviderOrchestratorSnapshot = {
  readonly identity: IdentityAdapterSnapshot;
  readonly compliance: ComplianceAdapterSnapshot;
  readonly fabric: ReturnType<ComplianceFabric['store']['snapshot']>;
};

export class ComplianceProviderOrchestrator {
  readonly identityStore = new IdentityAdapterStore();
  readonly complianceStore = new ComplianceAdapterStore();
  readonly fabric: ComplianceFabric;
  readonly kyc: KycAdapter;
  readonly documents: DocumentVerificationAdapter;
  readonly kyb: KybAdapter;
  readonly identityWebhook: IdentityAdapterWebhook;
  readonly sanctions: SanctionsAdapter;
  readonly pep: PepAdapter;
  readonly adverseMedia: AdverseMediaAdapter;
  readonly aml: AmlAdapter;
  readonly fraud: FraudAdapter;
  readonly complianceWebhook: ComplianceAdapterWebhook;
  readonly identityLifecycle;
  readonly complianceLifecycle;

  constructor(
    private readonly clock: Clock,
    options?: { readonly unavailable?: boolean },
  ) {
    const identityProfile = sandboxIdentityProfile();
    const complianceProfile = options?.unavailable ? unavailableComplianceProfile() : sandboxComplianceProfile();
    this.kyc = new KycAdapter(this.identityStore, identityProfile, identityStateForSubject);
    this.documents = new DocumentVerificationAdapter(this.identityStore, identityProfile, documentAuthenticityFor);
    this.kyb = new KybAdapter(this.identityStore, identityProfile, kybStateForBusiness);
    this.identityWebhook = new IdentityAdapterWebhook(this.identityStore, identityProfile);
    this.sanctions = new SanctionsAdapter(this.complianceStore, complianceProfile, sanctionsMatchFor);
    this.pep = new PepAdapter(this.complianceStore, complianceProfile, pepMatchFor);
    this.adverseMedia = new AdverseMediaAdapter(this.complianceStore, complianceProfile, adverseMediaMatchFor);
    this.aml = new AmlAdapter(this.complianceStore, complianceProfile, amlAlertFor);
    this.fraud = new FraudAdapter(this.complianceStore, complianceProfile, fraudActionFor);
    this.complianceWebhook = new ComplianceAdapterWebhook(this.complianceStore, complianceProfile);
    this.identityLifecycle = bindIdentityProviderLifecycle(identityProfile);
    this.complianceLifecycle = bindComplianceProviderLifecycle(complianceProfile);
    this.fabric = new ComplianceFabric({ clock: this.clock });
  }

  startKyc(input: { readonly identityId: string; readonly jurisdiction: Jurisdiction }): IdentityVerificationRecord {
    const applicant = this.kyc.createApplicant({
      identityId: input.identityId,
      jurisdiction: input.jurisdiction,
      now: this.clock.now(),
    });
    return this.kyc.startVerification({ applicantId: applicant.applicantId, now: this.clock.now() });
  }

  clientVerificationState(identityId: string): IdentityVerificationClientState {
    return toIdentityVerificationClientState(this.identityStore.latestVerification(identityId)?.state);
  }

  ingestFinding(finding: NormalizedComplianceFinding, jurisdiction: string): {
    readonly finding: NormalizedComplianceFinding;
    readonly caseLink: FindingCaseLink | null;
    readonly kernelHint: DecisionStatus;
    readonly facts: ComplianceFacts;
  } {
    const caseLink = openCaseFromFinding(this.fabric, finding, jurisdiction);
    const withCase: NormalizedComplianceFinding = Object.freeze({
      ...finding,
      caseId: caseLink?.caseId ?? finding.caseId,
    });
    this.complianceStore.findings.set(withCase.findingId, withCase);
    const facts = this.factsFromFinding(withCase);
    const escalated = escalateFromComplianceFacts('ALLOW', facts);
    return Object.freeze({
      finding: withCase,
      caseLink,
      kernelHint: escalated.status,
      facts,
    });
  }

  screenSanctions(input: {
    readonly subjectKind: ScreeningSubject;
    readonly subjectRef: string;
    readonly jurisdiction: string;
  }) {
    const finding = this.sanctions.screen({
      subjectKind: input.subjectKind,
      subjectRef: input.subjectRef,
      now: this.clock.now(),
    });
    this.fabric.screen({
      type: 'SANCTIONS',
      subjectRef: input.subjectRef,
      subjectKind: subjectToFabricKind(input.subjectKind),
      jurisdiction: input.jurisdiction,
      forceRefresh: true,
    });
    return this.ingestFinding(finding, input.jurisdiction);
  }

  screenPep(input: { readonly subjectRef: string; readonly jurisdiction: string; readonly relatedPersonRef?: string }) {
    const finding = this.pep.screen({
      subjectKind: 'PERSON',
      subjectRef: input.subjectRef,
      now: this.clock.now(),
      ...(input.relatedPersonRef ? { relatedPersonRef: input.relatedPersonRef } : {}),
    });
    return this.ingestFinding(finding, input.jurisdiction);
  }

  screenAdverseMedia(input: { readonly subjectRef: string; readonly jurisdiction: string }) {
    return this.ingestFinding(
      this.adverseMedia.screen({
        subjectKind: 'PERSON',
        subjectRef: input.subjectRef,
        now: this.clock.now(),
      }),
      input.jurisdiction,
    );
  }

  submitAml(signal: Omit<AmlSignal, 'now'> & { readonly now?: UtcInstant }) {
    const result = this.aml.submitSignal({ ...signal, now: signal.now ?? this.clock.now() });
    if (result.duplicate) {
      return Object.freeze({ ...result, caseLink: null, kernelHint: 'ALLOW' as const });
    }
    const ingested = this.ingestFinding(result.finding, 'GB');
    return Object.freeze({ ...result, finding: ingested.finding, caseLink: ingested.caseLink, kernelHint: ingested.kernelHint });
  }

  evaluateFraud(subjectRef: string) {
    const result = this.fraud.evaluate({ subjectRef, now: this.clock.now() });
    const ingested = this.ingestFinding(result.finding, 'GB');
    return Object.freeze({ ...result, finding: ingested.finding, caseLink: ingested.caseLink, kernelHint: ingested.kernelHint });
  }

  scheduleMonitoring(input: {
    readonly trigger: MonitoringTrigger;
    readonly subjectRef: string;
    readonly policyAllows: boolean;
  }) {
    return scheduleRescreen({
      store: this.complianceStore,
      trigger: input.trigger,
      subjectRef: input.subjectRef,
      now: this.clock.now(),
      policyAllows: input.policyAllows,
    });
  }

  exchangeFacts(subjectRef: string) {
    return toExchangeComplianceFact(this.complianceStore.latest(subjectRef, 'SANCTIONS') ?? null);
  }

  custodyFacts(identityId: string) {
    const verification = this.identityStore.latestVerification(identityId);
    return toCustodyComplianceFact({
      verificationState: verification?.state ?? 'NOT_STARTED',
      finding: this.complianceStore.latest(identityId, 'SANCTIONS') ?? null,
    });
  }

  outageDisposition(): ProviderOutageDisposition {
    return dispositionForOutage({
      required: true,
      posture: this.complianceLifecycle.health === 'UNAVAILABLE' ? 'BLOCK' : 'DEFER',
    });
  }

  flags() {
    return COMPLIANCE_ADAPTER_FLAGS;
  }

  snapshot(): ComplianceProviderOrchestratorSnapshot {
    return Object.freeze({
      identity: this.identityStore.snapshot(),
      compliance: this.complianceStore.snapshot(),
      fabric: this.fabric.store.snapshot(),
    });
  }

  hydrate(snapshot: ComplianceProviderOrchestratorSnapshot): void {
    this.identityStore.hydrate(snapshot.identity);
    this.complianceStore.hydrate(snapshot.compliance);
    this.fabric.hydrate(snapshot.fabric);
  }

  private factsFromFinding(finding: NormalizedComplianceFinding): ComplianceFacts {
    const outcome = finding.policyResult;
    const unavailable = finding.matchState === 'UNAVAILABLE' || outcome === 'UNAVAILABLE';
    return Object.freeze({
      sanctionsOutcome: finding.kind === 'SANCTIONS' ? outcome : null,
      pepOutcome: finding.kind === 'PEP' ? outcome : null,
      adverseMediaOutcome: finding.kind === 'ADVERSE_MEDIA' ? outcome : null,
      sanctionsFresh: finding.kind !== 'SANCTIONS' || !unavailable,
      pepFresh: true,
      adverseMediaFresh: true,
      requiredScreeningMissing: false,
      providerAvailable: !unavailable,
      outagePosture: unavailable ? 'BLOCK' : null,
      amlCategory: finding.kind === 'AML' && finding.severity === 'HIGH' ? 'HIGH' : 'STANDARD',
      fraudOutcome: finding.recommendedAction,
      velocityTriggered: false,
      hardBlock: finding.matchState === 'CONFIRMED_MATCH' && finding.kind === 'SANCTIONS',
      stepUpRequired: finding.recommendedAction === 'STEP_UP',
      latestScreeningId: finding.findingId,
      latestCaseId: finding.caseId,
      policyVersionId: null,
    });
  }
}
