import { isExpired } from '../../config/src/clock.ts';
import type { Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import { isVerifiedActorContext, type VerifiedActorContext } from '../../identity/src/actor-context.ts';
import { assuranceAtLeast } from '../../identity/src/assurance.ts';
import { requiredAssuranceFor, type IdentityCapability } from '../../identity/src/capability.ts';
import type { ConsentService, PermitRequest } from '../../consent/src/service.ts';
import type { DataUsePermit } from '../../consent/src/types.ts';
import type { PersonalDataVault } from '../../personal-data-vault/src/service.ts';
import type { DataAsset } from '../../personal-data-vault/src/types.ts';
import type { KeyProvider } from '../../security/src/provider.ts';
import { sha256Hex } from '../../security/src/hash.ts';
import { consumeBudget, emptyBudget } from './budget.ts';
import { runApprovedComputation, type EphemeralRow } from './compute.ts';
import { recordContribution, toPegSafeReference, toPeveContributionInput } from './contribution.ts';
import { buildLineage, isForbiddenAutoField, minimizePayload } from './dataset.ts';
import { evaluateEgress } from './egress.ts';
import { EphemeralWorkspace } from './ephemeral.ts';
import { issueJoinToken } from './joins.ts';
import {
  asPrivacyPolicyVersion,
  newAuthorizationSnapshotId,
  newCleanRoomJobId,
  newCleanRoomQueryId,
  newCleanRoomSessionId,
  newComputationReceiptId,
} from './ids.ts';
import { DEFAULT_POLICY, simulateCandidatePolicy } from './ports.ts';
import { queryFingerprint, QueryTemplateRegistry, rejectArbitraryQuery } from './query.ts';
import { RequesterRegistry } from './requesters.ts';
import { CleanRoomStore } from './store.ts';
import {
  canTransitionJob,
  canTransitionSession,
  COMPUTATION_IMPLEMENTATION,
  EVIDENCE_KIND_CLEAN_ROOM,
  SIMULATION_PRIVACY_POLICY_VERSION,
  SIMULATION_THRESHOLDS,
  type CleanRoomReasonCode,
} from './taxonomy.ts';
import type {
  AuthorizationSnapshot,
  CandidatePolicySimulation,
  CleanRoomComputationReceipt,
  CleanRoomFailure,
  CleanRoomJob,
  CleanRoomSession,
  CleanRoomStoreSnapshot,
  ContributionComputationReference,
  JobOutcome,
  QueryAst,
  QueryTemplate,
  SubjectAuthorization,
} from './types.ts';

export const CLEAN_ROOM_REQUEST_CAPABILITY: IdentityCapability = 'CLEAN_ROOM_REQUEST';

export type CleanRoomServiceOptions = {
  readonly clock: Clock;
  readonly keys: KeyProvider;
  readonly evidence: EvidenceVault;
  readonly events: DomainEventLog;
  readonly consent: ConsentService;
  readonly vault: PersonalDataVault;
  readonly store?: CleanRoomStore;
  readonly requesters?: RequesterRegistry;
};

export type CreateSessionInput = {
  readonly requesterId: string;
  readonly purposeRef: string;
  readonly proposedSubjectIds: readonly string[];
  readonly allowedTemplateIds?: readonly string[];
  readonly expiresAt: UtcInstant;
  readonly idempotencyKey: string;
};

function hasCapability(actor: VerifiedActorContext, capability: IdentityCapability): boolean {
  return actor.authorizedCapabilities.includes(capability);
}

export class CleanRoomService {
  private readonly clock: Clock;
  private readonly keys: KeyProvider;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly consent: ConsentService;
  private readonly vault: PersonalDataVault;
  private readonly store: CleanRoomStore;
  private readonly requesters: RequesterRegistry;
  private readonly templates = new QueryTemplateRegistry();

  constructor(options: CleanRoomServiceOptions) {
    this.clock = options.clock;
    this.keys = options.keys;
    this.evidence = options.evidence;
    this.events = options.events;
    this.consent = options.consent;
    this.vault = options.vault;
    this.store = options.store ?? new CleanRoomStore();
    this.requesters = options.requesters ?? new RequesterRegistry();
  }

  bindRequester(requesterId: Parameters<RequesterRegistry['bindActor']>[0], actorSubjectId: string): void {
    this.requesters.bindActor(requesterId, actorSubjectId);
  }

  createSession(actor: unknown, input: CreateSessionInput): Result<CleanRoomSession, CleanRoomFailure> {
    const verified = this.requireRequester(actor);
    if (!verified.ok) {
      return verified;
    }
    const replay = this.store.sessionForKey(input.idempotencyKey);
    if (replay) {
      const existing = this.store.getSession(replay);
      if (existing) {
        return ok(existing);
      }
    }
    const requester = this.requesters.get(input.requesterId);
    if (!requester) {
      return err({ code: 'REQUESTER_UNKNOWN', message: 'requester is not a registered simulation research partner' });
    }
    if (requester.actorSubjectId && requester.actorSubjectId !== verified.value.subjectId) {
      return err({ code: 'REQUESTER_MISMATCH', message: 'actor is not bound to this requester' });
    }
    if (!requester.actorSubjectId) {
      this.requesters.bindActor(requester.requesterId, verified.value.subjectId);
    }
    const purpose = this.consent.getPurposeDescription(input.purposeRef);
    if (!purpose.ok) {
      return err({ code: 'PURPOSE_MISMATCH', message: purpose.error.message });
    }
    const now = this.clock.now();
    if (isExpired(input.expiresAt, now)) {
      return err({ code: 'SESSION_EXPIRED', message: 'session expiration must be in the future' });
    }
    const templates = (input.allowedTemplateIds ?? this.templates.list().map((row) => row.templateId)).map((id) => {
      const found = this.templates.get(id) ?? this.templates.getByCode(id);
      return found?.templateId;
    });
    if (templates.some((id) => !id)) {
      return err({ code: 'TEMPLATE_UNKNOWN', message: 'one or more query templates are not registered' });
    }
    const session: CleanRoomSession = Object.freeze({
      sessionId: newCleanRoomSessionId(),
      requesterId: requester.requesterId,
      recipientId: requester.recipientId,
      requesterActorId: verified.value.actorId,
      proposedSubjectIds: Object.freeze([...input.proposedSubjectIds]),
      purposeId: purpose.value.purposeId,
      purposeVersion: purpose.value.purposeVersion,
      purposeRef: input.purposeRef,
      consentIds: Object.freeze([]),
      consentVersions: Object.freeze([]),
      permitIds: Object.freeze([]),
      allowedCategories: Object.freeze([...purpose.value.allowedCategories]),
      allowedFields: Object.freeze(['transactions', 'category', 'amountMinor', 'bookedAt', 'currency']),
      allowedTemplateIds: Object.freeze(templates.filter((id): id is NonNullable<typeof id> => Boolean(id))),
      privacyPolicyVersion: asPrivacyPolicyVersion(SIMULATION_PRIVACY_POLICY_VERSION),
      authorizationSnapshotId: null,
      createdAt: now,
      expiresAt: input.expiresAt,
      status: 'CREATED',
      denialReason: null,
    });
    this.store.putSession(session);
    this.store.rememberSession(input.idempotencyKey, session.sessionId);
    this.store.putBudget(
      emptyBudget({
        sessionId: session.sessionId,
        requesterId: session.requesterId,
        purposeId: session.purposeId,
        expiresAt: session.expiresAt,
      }),
    );
    this.emit('CleanRoomSessionCreated', session.sessionId, {
      sessionId: session.sessionId,
      requesterId: session.requesterId,
      purposeRef: session.purposeRef,
    });
    this.seal('session.created', { sessionId: session.sessionId, requesterId: session.requesterId });
    return ok(this.transitionSession(session, 'AUTHORIZATION_PENDING'));
  }

  authorizeSession(actor: unknown, sessionId: string): Result<CleanRoomSession, CleanRoomFailure> {
    const verified = this.requireRequester(actor);
    if (!verified.ok) {
      return verified;
    }
    const current = this.requireFreshSession(sessionId);
    if (!current.ok) {
      return current;
    }
    if (current.value.requesterActorId !== verified.value.actorId) {
      return err({ code: 'REQUESTER_MISMATCH', message: 'session is bound to a different requester' });
    }
    const snapshot = this.authorizeCohort(verified.value, current.value);
    this.store.putSnapshot(snapshot);
    const qualified = snapshot.subjects.filter((row) => row.qualified);
    if (qualified.length === 0) {
      const denied = this.transitionSession(current.value, 'DENIED', 'NO_ACTIVE_CONSENT');
      this.emit('CleanRoomSessionDenied', denied.sessionId, {
        sessionId: denied.sessionId,
        reasonCode: 'NO_ACTIVE_CONSENT',
        cohortCount: 0,
      });
      return err({ code: 'NO_ACTIVE_CONSENT', message: 'no proposed subject independently qualified' });
    }
    const authorized = Object.freeze({
      ...this.transitionSession(current.value, 'AUTHORIZED'),
      authorizationSnapshotId: snapshot.snapshotId,
      consentIds: Object.freeze(qualified.flatMap((row) => (row.consentId ? [row.consentId] : []))),
      consentVersions: Object.freeze(qualified.flatMap((row) => (row.consentVersion ? [row.consentVersion] : []))),
      permitIds: Object.freeze(qualified.flatMap((row) => (row.permitId ? [row.permitId] : []))),
    });
    this.store.putSession(authorized);
    this.emit('CleanRoomSessionAuthorized', authorized.sessionId, {
      sessionId: authorized.sessionId,
      requesterId: authorized.requesterId,
      cohortCount: qualified.length,
      purposeVersion: authorized.purposeVersion,
    });
    this.seal('session.authorized', {
      sessionId: authorized.sessionId,
      snapshotId: snapshot.snapshotId,
      cohortCount: qualified.length,
    });
    return ok(authorized);
  }

  submitAndExecute(
    actor: unknown,
    sessionId: string,
    templateRef: string | QueryAst | Record<string, unknown>,
  ): Result<JobOutcome, CleanRoomFailure> {
    const verified = this.requireRequester(actor);
    if (!verified.ok) {
      return verified;
    }
    const session = this.requireFreshSession(sessionId);
    if (!session.ok) {
      return session;
    }
    if (session.value.status !== 'AUTHORIZED' && session.value.status !== 'COMPLETED') {
      return err({ code: 'SESSION_NOT_AUTHORIZED', message: `session status ${session.value.status} cannot run a job` });
    }
    if (session.value.requesterActorId !== verified.value.actorId) {
      return err({ code: 'REQUESTER_MISMATCH', message: 'session is bound to a different requester' });
    }
    const parsed = this.resolveTemplate(session.value, templateRef);
    if (!parsed.ok) {
      return parsed;
    }
    const { template, ast } = parsed.value;
    if (ast.rawRowExport) {
      return this.denyRaw(session.value, template, ast, verified.value);
    }
    const budget = this.store.getBudget(session.value.sessionId);
    if (!budget) {
      return err({ code: 'QUERY_BUDGET_EXHAUSTED', message: 'session has no query budget' });
    }
    const fingerprint = queryFingerprint(template, ast);
    const consumed = consumeBudget({
      budget,
      ast,
      now: this.clock.now(),
      fingerprint,
      seenFingerprints: this.store.fingerprintsFor(session.value.sessionId),
    });
    if (!consumed.ok) {
      return consumed;
    }
    this.store.putBudget(consumed.value);
    this.store.rememberFingerprint(session.value.sessionId, fingerprint);

    const job: CleanRoomJob = Object.freeze({
      jobId: newCleanRoomJobId(),
      sessionId: session.value.sessionId,
      queryId: newCleanRoomQueryId(),
      templateId: template.templateId,
      templateVersion: template.version,
      ast,
      authorizationSnapshotId: session.value.authorizationSnapshotId ?? newAuthorizationSnapshotId(),
      datasetId: null,
      status: 'QUEUED',
      createdAt: this.clock.now(),
      startedAt: null,
      completedAt: null,
      reasonCode: null,
    });
    this.store.putJob(job);
    this.store.putSession(this.transitionSession(session.value, 'RUNNING'));
    return this.executeJob(verified.value, job.jobId);
  }

  requestRawRows(actor: unknown, sessionId: string): Result<JobOutcome, CleanRoomFailure> {
    return this.submitAndExecute(actor, sessionId, 'raw_row_export');
  }

  joinToken(actor: unknown, subjectId: string, purposeId: string, requesterId: string): Result<string, CleanRoomFailure> {
    const verified = this.requireRequester(actor);
    if (!verified.ok) {
      return verified;
    }
    const requester = this.requesters.get(requesterId);
    if (!requester || requester.actorSubjectId !== verified.value.subjectId) {
      return err({ code: 'REQUESTER_MISMATCH', message: 'join tokens are requester-bound' });
    }
    const token = issueJoinToken({
      keys: this.keys,
      requesterId: requester.requesterId,
      purposeId,
      subjectId,
      now: this.clock.now(),
    });
    if (!token.ok) {
      return token;
    }
    this.store.putJoinMetadata({
      joinKeyId: token.value.joinKeyId,
      requesterId: requester.requesterId,
      purposeId: purposeId as never,
      createdAt: token.value.createdAt,
    });
    return ok(token.value.tokenHex);
  }

  getReceipt(receiptId: string): CleanRoomComputationReceipt | undefined {
    return this.store.getReceipt(receiptId);
  }

  listContributions(): readonly ContributionComputationReference[] {
    return this.store.listContributions();
  }

  simulatePolicy(candidate: CandidatePolicySimulation) {
    return simulateCandidatePolicy(DEFAULT_POLICY, candidate, this.store.snapshot().sessions);
  }

  pegReference(receipt: CleanRoomComputationReceipt) {
    return toPegSafeReference(receipt);
  }

  peveInput(ref: ContributionComputationReference) {
    return toPeveContributionInput(ref);
  }

  snapshot(): CleanRoomStoreSnapshot {
    return this.store.snapshot();
  }

  restore(state: CleanRoomStoreSnapshot): void {
    this.store.restore(state);
  }

  requestersRegistry(): RequesterRegistry {
    return this.requesters;
  }

  private executeJob(actor: VerifiedActorContext, jobId: string): Result<JobOutcome, CleanRoomFailure> {
    const job = this.store.getJob(jobId);
    const session = job ? this.store.getSession(job.sessionId) : undefined;
    if (!job || !session) {
      return err({ code: 'DEFAULT_DENY', message: 'job not found' });
    }
    this.store.putJob(this.transitionJob(job, 'AUTHORIZING', { startedAt: this.clock.now() }));
    this.emit('CleanRoomJobStarted', job.jobId, {
      jobId: job.jobId,
      sessionId: session.sessionId,
      templateId: job.templateId,
    });
    const snapshot = this.authorizeCohort(actor, session);
    this.store.putSnapshot(snapshot);
    const qualified = snapshot.subjects.filter((row) => row.qualified);
    if (qualified.length === 0) {
      return this.failJob(job, session, 'NO_ACTIVE_CONSENT', 'no subject remained authorized at execution');
    }
    if (qualified.length < SIMULATION_THRESHOLDS.minCohortSize) {
      const suppressed = this.finishWithEgress(actor, job, session, snapshot, qualified, null, true);
      return suppressed;
    }
    this.store.putJob(this.transitionJob(this.store.getJob(job.jobId) ?? job, 'RUNNING'));
    const workspace = new EphemeralWorkspace();
    const assets: Array<DatasetLineage['assetRefs'][number]> = [];
    try {
      for (const subject of qualified) {
        const loaded = this.loadMinimized(actor, session, subject);
        if (!loaded.ok) {
          continue;
        }
        for (const row of loaded.value.rows) {
          workspace.add(row);
        }
        assets.push(...loaded.value.assets);
      }
      const rows = workspace.snapshot();
      const result = runApprovedComputation(job.ast, rows);
      const lineage = buildLineage({
        sessionId: session.sessionId,
        jobId: job.jobId,
        rows,
        assets,
        fields: session.allowedFields,
        createdAt: this.clock.now(),
      });
      this.store.putLineage(lineage);
      workspace.release();
      const beforeEgress = this.authorizeCohort(actor, session);
      const stillQualified = beforeEgress.subjects.filter((row) => row.qualified);
      if (stillQualified.length < qualified.length) {
        const excluded = this.finishWithEgress(actor, job, session, beforeEgress, stillQualified, result, false);
        return excluded;
      }
      return this.finishWithEgress(actor, job, session, snapshot, qualified, result, false, lineage.datasetId);
    } finally {
      if (!workspace.released()) {
        workspace.release();
      }
    }
  }

  private finishWithEgress(
    actor: VerifiedActorContext,
    job: CleanRoomJob,
    session: CleanRoomSession,
    snapshot: AuthorizationSnapshot,
    qualified: readonly SubjectAuthorization[],
    result: ReturnType<typeof runApprovedComputation> | null,
    forceSmallCohort: boolean,
    datasetId?: string,
  ): Result<JobOutcome, CleanRoomFailure> {
    this.store.putJob(this.transitionJob(this.store.getJob(job.jobId) ?? job, 'EGRESS_PENDING'));
    const egress = evaluateEgress({
      ast: job.ast,
      result,
      cohortSize: qualified.length,
      onwardSharing: false,
      onwardSharingAllowed: false,
      privacyPolicyVersion: session.privacyPolicyVersion,
      now: this.clock.now(),
      jobId: job.jobId,
      uncertain: forceSmallCohort ? false : result === null,
    });
    this.store.putEgress(egress);
    const egressEvent =
      egress.decision === 'RELEASE'
        ? 'CleanRoomEgressReleased'
        : egress.decision === 'SUPPRESS'
          ? 'CleanRoomEgressSuppressed'
          : 'CleanRoomEgressDenied';
    this.emit(egressEvent, job.jobId, {
      jobId: job.jobId,
      sessionId: session.sessionId,
      egressDecision: egress.decision,
      reasonCode: egress.reasonCode,
      cohortCount: qualified.length,
    });
    if (egress.decision !== 'RELEASE' || !result) {
      const deniedJob = this.transitionJob(this.store.getJob(job.jobId) ?? job, 'DENIED', {
        completedAt: this.clock.now(),
        reasonCode: egress.reasonCode,
        ...(datasetId ? { datasetId: datasetId as never } : {}),
      });
      this.store.putSession(this.transitionSession(session, 'AUTHORIZED', egress.reasonCode));
      this.emit('CleanRoomJobFailed', deniedJob.jobId, {
        jobId: deniedJob.jobId,
        reasonCode: egress.reasonCode,
      });
      return ok({
        job: deniedJob,
        egress,
        receipt: null,
        result: null,
        contributions: Object.freeze([]),
      });
    }
    const receipt = this.issueReceipt(session, job, snapshot, qualified, result, egress);
    this.store.putReceipt(receipt);
    const contributions: ContributionComputationReference[] = [];
    for (const subject of qualified) {
      const assets = snapshot.subjects
        .filter((row) => row.subjectId === subject.subjectId)
        .flatMap((row) => (row.permitId ? [row.permitId] : []));
      const recorded = recordContribution({
        subjectId: subject.subjectId,
        receipt,
        assetRefs: assets,
        freshness: this.clock.now(),
        schemaCompleteness: 'COMPLETE',
        duplicate: false,
        alreadyRecorded: this.store.hasContribution(subject.subjectId, receipt.receiptId, assets),
      });
      if (recorded.ok) {
        this.store.putContribution(recorded.value);
        contributions.push(recorded.value);
        this.emit('CleanRoomContributionRecorded', recorded.value.contributionId, {
          contributionId: recorded.value.contributionId,
          receiptId: receipt.receiptId,
          purposeVersion: session.purposeVersion,
        });
      }
    }
    const completed = this.transitionJob(this.store.getJob(job.jobId) ?? job, 'COMPLETED', {
      completedAt: this.clock.now(),
      reasonCode: 'ALLOWED',
      ...(datasetId ? { datasetId: datasetId as never } : {}),
    });
    this.store.putSession(this.transitionSession(session, 'AUTHORIZED'));
    this.emit('CleanRoomJobCompleted', completed.jobId, {
      jobId: completed.jobId,
      sessionId: session.sessionId,
      receiptId: receipt.receiptId,
      cohortCount: qualified.length,
    });
    this.seal('job.completed', {
      jobId: completed.jobId,
      receiptId: receipt.receiptId,
      requesterId: session.requesterId,
      purposeVersion: session.purposeVersion,
    });
    void actor;
    return ok({
      job: completed,
      egress,
      receipt,
      result,
      contributions: Object.freeze(contributions),
    });
  }

  private denyRaw(
    session: CleanRoomSession,
    template: QueryTemplate,
    ast: QueryAst,
    actor: VerifiedActorContext,
  ): Result<JobOutcome, CleanRoomFailure> {
    const job: CleanRoomJob = Object.freeze({
      jobId: newCleanRoomJobId(),
      sessionId: session.sessionId,
      queryId: newCleanRoomQueryId(),
      templateId: template.templateId,
      templateVersion: template.version,
      ast,
      authorizationSnapshotId: session.authorizationSnapshotId ?? newAuthorizationSnapshotId(),
      datasetId: null,
      status: 'DENIED',
      createdAt: this.clock.now(),
      startedAt: this.clock.now(),
      completedAt: this.clock.now(),
      reasonCode: 'RAW_ROW_EXPORT_DENIED',
    });
    this.store.putJob(job);
    const egress = evaluateEgress({
      ast,
      result: null,
      cohortSize: 0,
      onwardSharing: false,
      onwardSharingAllowed: false,
      privacyPolicyVersion: session.privacyPolicyVersion,
      now: this.clock.now(),
      jobId: job.jobId,
    });
    this.store.putEgress(egress);
    this.emit('CleanRoomEgressDenied', job.jobId, {
      jobId: job.jobId,
      sessionId: session.sessionId,
      reasonCode: 'RAW_ROW_EXPORT_DENIED',
    });
    void actor;
    return ok({ job, egress, receipt: null, result: null, contributions: Object.freeze([]) });
  }

  private authorizeCohort(actor: VerifiedActorContext, session: CleanRoomSession): AuthorizationSnapshot {
    const subjects: SubjectAuthorization[] = [];
    for (const subjectId of session.proposedSubjectIds) {
      const request: PermitRequest = {
        subjectId,
        recipientId: session.recipientId,
        purposeRef: session.purposeRef,
        resourceId: subjectId,
        category: 'TRANSACTION_DATA',
        fields: session.allowedFields,
        operation: 'AGGREGATE',
        derivationType: 'AGGREGATE_ONLY',
      };
      const issued = this.consent.issuePermitForRecipient(actor, request);
      if (!issued.ok) {
        subjects.push({
          subjectId,
          qualified: false,
          reasonCode: mapConsentCode(issued.error.code),
          consentId: null,
          consentVersion: null,
          permitId: null,
          purposeId: null,
          purposeVersion: null,
        });
        continue;
      }
      const verified = this.consent.verifyPermit(issued.value.permit, {
        subjectId,
        recipientId: session.recipientId,
        purposeId: session.purposeId,
      });
      if (!verified.ok) {
        subjects.push({
          subjectId,
          qualified: false,
          reasonCode: mapConsentCode(verified.error.code),
          consentId: issued.value.permit.consentId,
          consentVersion: issued.value.permit.consentVersion,
          permitId: issued.value.permit.permitId,
          purposeId: issued.value.permit.purposeId,
          purposeVersion: issued.value.permit.purposeVersion,
        });
        continue;
      }
      subjects.push({
        subjectId,
        qualified: true,
        reasonCode: 'ALLOWED',
        consentId: verified.value.consentId,
        consentVersion: verified.value.consentVersion,
        permitId: verified.value.permitId,
        purposeId: verified.value.purposeId,
        purposeVersion: verified.value.purposeVersion,
      });
    }
    const qualifiedSubjectIds = subjects.filter((row) => row.qualified).map((row) => row.subjectId);
    const createdAt = this.clock.now();
    const hash = sha256Hex(
      JSON.stringify({
        sessionId: session.sessionId,
        subjects: subjects.map((row) => ({
          subjectId: row.subjectId,
          qualified: row.qualified,
          consentId: row.consentId,
          consentVersion: row.consentVersion,
          permitId: row.permitId,
        })),
      }),
    );
    return Object.freeze({
      snapshotId: newAuthorizationSnapshotId(),
      sessionId: session.sessionId,
      subjects: Object.freeze(subjects),
      qualifiedSubjectIds: Object.freeze(qualifiedSubjectIds),
      createdAt,
      hash,
    });
  }

  private loadMinimized(
    actor: VerifiedActorContext,
    session: CleanRoomSession,
    subject: SubjectAuthorization,
  ): Result<{ rows: EphemeralRow[]; assets: DatasetLineage['assetRefs'] }, CleanRoomFailure> {
    const listed = this.vault.listAssetsForAuthorizedUse(actor, {
      subjectId: subject.subjectId,
      purposeRef: session.purposeRef,
      useClass: 'THIRD_PARTY',
      recipientId: session.recipientId,
      category: 'TRANSACTION_DATA',
      capability: CLEAN_ROOM_REQUEST_CAPABILITY,
    });
    if (!listed.ok) {
      return err({ code: 'RESOURCE_OUT_OF_SCOPE', message: listed.error.message });
    }
    const rows: EphemeralRow[] = [];
    const assets: Array<DatasetLineage['assetRefs'][number]> = [];
    for (const asset of listed.value) {
      if (isForbiddenAutoField(asset.category)) {
        continue;
      }
      const payload = this.vault.readForAuthorizedUse(actor, {
        subjectId: subject.subjectId,
        assetId: asset.assetId,
        purposeRef: session.purposeRef,
        useClass: 'THIRD_PARTY',
        operation: 'READ_MINIMIZED',
        requestedScope: 'aggregate',
        fields: ['transactions', ...session.allowedFields],
        category: asset.category,
        capability: CLEAN_ROOM_REQUEST_CAPABILITY,
        recipientId: session.recipientId,
      });
      if (!payload.ok) {
        continue;
      }
      for (const fields of minimizePayload(payload.value, session.allowedFields)) {
        rows.push({ subjectId: subject.subjectId, fields });
      }
      assets.push({
        subjectId: subject.subjectId,
        assetId: asset.assetId,
        versionId: asset.currentVersionId,
        contentSha256: asset.contentSha256,
        category: asset.category,
      });
    }
    return ok({ rows, assets });
  }

  private issueReceipt(
    session: CleanRoomSession,
    job: CleanRoomJob,
    snapshot: AuthorizationSnapshot,
    qualified: readonly SubjectAuthorization[],
    result: ReturnType<typeof runApprovedComputation>,
    egress: ReturnType<typeof evaluateEgress>,
  ): CleanRoomComputationReceipt {
    return Object.freeze({
      receiptId: newComputationReceiptId(),
      sessionId: session.sessionId,
      jobId: job.jobId,
      requesterId: session.requesterId,
      purposeId: session.purposeId,
      purposeVersion: session.purposeVersion,
      consentRefs: Object.freeze(
        qualified.flatMap((row) =>
          row.consentId && row.consentVersion ? [{ consentId: row.consentId, version: row.consentVersion }] : [],
        ),
      ),
      consentSnapshotHash: snapshot.hash,
      permitIds: Object.freeze(qualified.flatMap((row) => (row.permitId ? [row.permitId] : []))),
      templateId: job.templateId,
      templateVersion: job.templateVersion,
      inputAssetHashes: Object.freeze(
        this.store.snapshot().lineage.filter((row) => row.jobId === job.jobId).flatMap((row) => row.assetRefs.map((asset) => asset.contentSha256 ?? asset.assetId)),
      ),
      authorizedCohortCount: qualified.length,
      computationImplementation: COMPUTATION_IMPLEMENTATION.id,
      computationVersion: COMPUTATION_IMPLEMENTATION.version,
      privacyPolicyVersion: session.privacyPolicyVersion,
      egressDecision: egress.decision,
      resultHash: sha256Hex(JSON.stringify(result)),
      generatedAt: this.clock.now(),
      rawInputIncluded: false,
      immutable: true,
    });
  }

  private resolveTemplate(
    session: CleanRoomSession,
    templateRef: string | QueryAst | Record<string, unknown>,
  ): Result<{ template: QueryTemplate; ast: QueryAst }, CleanRoomFailure> {
    if (typeof templateRef !== 'string') {
      const rejected = rejectArbitraryQuery(templateRef);
      return rejected.ok
        ? err({ code: 'UNSUPPORTED_OPERATION', message: 'external callers must use a versioned query template, not a free AST' })
        : rejected;
    }
    if (/^\s*SELECT\b/i.test(templateRef) || templateRef.includes('SELECT *')) {
      return err({ code: 'ARBITRARY_SQL_FORBIDDEN', message: 'arbitrary SQL is forbidden' });
    }
    const template = this.templates.getByCode(templateRef) ?? this.templates.get(templateRef);
    if (!template || template.status !== 'ACTIVE') {
      return err({ code: 'TEMPLATE_UNKNOWN', message: 'query template is not registered' });
    }
    if (!session.allowedTemplateIds.includes(template.templateId)) {
      return err({ code: 'TEMPLATE_NOT_ALLOWED', message: 'template is not allowed on this session' });
    }
    return ok({ template, ast: template.ast });
  }

  private requireFreshSession(sessionId: string): Result<CleanRoomSession, CleanRoomFailure> {
    const session = this.store.getSession(sessionId);
    if (!session) {
      return err({ code: 'SESSION_NOT_AUTHORIZED', message: 'session not found' });
    }
    if (session.status === 'REVOKED') {
      return err({ code: 'SESSION_REVOKED', message: 'session was revoked' });
    }
    if (session.status === 'EXPIRED' || isExpired(session.expiresAt, this.clock.now())) {
      if (session.status !== 'EXPIRED') {
        this.store.putSession(this.transitionSession(session, 'EXPIRED'));
      }
      return err({ code: 'SESSION_EXPIRED', message: 'session has expired' });
    }
    return ok(session);
  }

  private requireRequester(actor: unknown): Result<VerifiedActorContext, CleanRoomFailure> {
    if (!isVerifiedActorContext(actor)) {
      return err({ code: 'ACTOR_CONTEXT_REQUIRED', message: 'Clean Room requires a verified ActorContext' });
    }
    if (!hasCapability(actor, CLEAN_ROOM_REQUEST_CAPABILITY)) {
      return err({ code: 'CAPABILITY_DENIED', message: 'CLEAN_ROOM_REQUEST is required; possessing a DataAssetId is not authorization' });
    }
    if (!assuranceAtLeast(actor.authenticationAssurance, requiredAssuranceFor(CLEAN_ROOM_REQUEST_CAPABILITY))) {
      return err({ code: 'ASSURANCE_INSUFFICIENT', message: 'requester assurance is insufficient' });
    }
    return ok(actor);
  }

  private transitionSession(
    session: CleanRoomSession,
    status: CleanRoomSession['status'],
    denialReason: CleanRoomReasonCode | null = session.denialReason,
  ): CleanRoomSession {
    if (session.status !== status && !canTransitionSession(session.status, status)) {
      throw new Error(`illegal session transition ${session.status} -> ${status}`);
    }
    const next = Object.freeze({ ...session, status, denialReason });
    this.store.putSession(next);
    return next;
  }

  private transitionJob(
    job: CleanRoomJob,
    status: CleanRoomJob['status'],
    patch: Partial<Pick<CleanRoomJob, 'startedAt' | 'completedAt' | 'reasonCode' | 'datasetId'>> = {},
  ): CleanRoomJob {
    if (job.status !== status && !canTransitionJob(job.status, status)) {
      throw new Error(`illegal job transition ${job.status} -> ${status}`);
    }
    const next = Object.freeze({ ...job, status, ...patch });
    this.store.putJob(next);
    return next;
  }

  private failJob(
    job: CleanRoomJob,
    session: CleanRoomSession,
    code: CleanRoomReasonCode,
    message: string,
  ): Result<JobOutcome, CleanRoomFailure> {
    const failed = this.transitionJob(this.store.getJob(job.jobId) ?? job, 'FAILED', {
      completedAt: this.clock.now(),
      reasonCode: code,
    });
    this.store.putSession(this.transitionSession(session, 'FAILED', code));
    this.emit('CleanRoomJobFailed', failed.jobId, { jobId: failed.jobId, reasonCode: code });
    return err({ code, message });
  }

  private emit(eventType: string, aggregateId: string, payload: Record<string, unknown>): void {
    this.events.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload,
      aggregateType: 'clean_room',
      aggregateId,
    } as never);
  }

  private seal(kind: string, payload: Record<string, unknown>): void {
    this.evidence.seal(`${EVIDENCE_KIND_CLEAN_ROOM}:${kind}`, {
      ...payload,
      kind,
      simulation: true,
      plaintextIncluded: false,
    });
  }
}

function mapConsentCode(code: string): CleanRoomReasonCode {
  const known: readonly CleanRoomReasonCode[] = [
    'NO_ACTIVE_CONSENT',
    'CONSENT_REVOKED',
    'CONSENT_EXPIRED',
    'PURPOSE_MISMATCH',
    'RECIPIENT_OUT_OF_SCOPE',
    'RESOURCE_OUT_OF_SCOPE',
    'OPERATION_OUT_OF_SCOPE',
    'CAPABILITY_DENIED',
    'ACTOR_CONTEXT_REQUIRED',
  ];
  return known.includes(code as CleanRoomReasonCode) ? (code as CleanRoomReasonCode) : 'DEFAULT_DENY';
}

type DatasetLineage = import('./types.ts').DatasetLineage;
