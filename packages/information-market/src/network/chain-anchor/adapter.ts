import { createHash, randomUUID } from 'node:crypto';

import type { Clock } from '../../../../config/src/clock.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import {
  chainIdFor,
  contentCommitmentFor,
  networkIdFor,
  type EconomicAssetChainAnchor,
  type EconomicAssetClass,
} from '../../../../economic-asset-registry/src/index.ts';
import { commitRecordSchema } from '../../../../sunrey-chain/src/hash.ts';
import { SunReyChainService, type CreateIntentInput } from '../../../../sunrey-chain/src/service.ts';
import type {
  ChainOperation,
  ChainRecordSchema,
  ChainWriteIntent,
  ScopedSubjectReference,
} from '../../../../sunrey-chain/src/types.ts';
import type { HumanContributionRegistryPort } from '../contribution/contract.ts';
import type { HumanInformationNetworkEngine } from '../engine.ts';
import {
  computationCommitment,
  consentCommitment,
  contributionProofCommitment,
  humanInformationAnchorKey,
  provenanceCommitment,
  purposeGrantCommitment,
  revocationCommitment,
  rightStateCommitment,
  usageReceiptCommitment,
} from './commitments.ts';
import { chainRecordTypeFor, HIN_CHAIN_ANCHOR_INVARIANTS, HIN_CHAIN_ANCHOR_OWNER } from './policy.ts';
import type { HumanInformationChainAnchorPort } from './port.ts';
import {
  assertPrivacySafeAnchorMaterial,
  buildComputationAnchorSchema,
  buildConsentAnchorSchema,
  buildContributionProofAnchorSchema,
  buildProvenanceAnchorSchema,
  buildPurposeGrantAnchorSchema,
  buildRevocationAnchorSchema,
  buildRightStateAnchorSchema,
  buildSettlementReferenceAnchorSchema,
  buildUsageReceiptAnchorSchema,
} from './schemas.ts';
import type {
  HinAnchorFailure,
  HinAnchorRequest,
  HinSubjectScope,
  HumanInformationAnchorId,
  HumanInformationAnchorKey,
  HumanInformationChainAnchorRecord,
} from './types.ts';
import { HIN_ANCHOR_KINDS } from './types.ts';

export type HinChainAnchorAdapterOptions = {
  readonly engine: HumanInformationNetworkEngine;
  readonly chain: SunReyChainService;
  readonly clock: Clock;
  readonly contributionRegistry?: HumanContributionRegistryPort;
};

function newAnchorId(): HumanInformationAnchorId {
  return `hianchor_${randomUUID().replace(/-/g, '').slice(0, 20)}` as HumanInformationAnchorId;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function mapChainFailure(code: string, message: string): HinAnchorFailure {
  if (code === 'CHAIN_UNAVAILABLE') {
    return { code: 'HIN_ANCHOR_CHAIN_UNAVAILABLE', message };
  }
  if (
    code === 'FORBIDDEN_ON_CHAIN_FIELD' ||
    code === 'RAW_SENSITIVE_DATA_DENIED' ||
    code === 'DATA_CLASSIFICATION_DENIED'
  ) {
    return { code: 'HIN_ANCHOR_PRIVACY_VIOLATION', message };
  }
  if (code === 'SCHEMA_MISMATCH') {
    return { code: 'HIN_ANCHOR_SCHEMA_INVALID', message };
  }
  return { code: 'HIN_ANCHOR_INTENT_CREATION_FAILED', message };
}

function mapOperationState(operation: ChainOperation): HumanInformationChainAnchorRecord['state'] {
  if (operation.state === 'CREATED' || operation.state === 'QUEUED') {
    return 'INTENT_CREATED';
  }
  if (operation.state === 'SUBMITTED' || operation.state === 'ACCEPTED') {
    return 'SUBMITTED';
  }
  if (
    operation.state === 'PENDING_FINALITY' ||
    operation.state === 'FINALIZED' ||
    operation.state === 'REJECTED' ||
    operation.state === 'UNKNOWN' ||
    operation.state === 'REORG_OBSERVED' ||
    operation.state === 'FAILED'
  ) {
    return operation.state;
  }
  return 'UNKNOWN';
}

/**
 * Privacy-safe HIN → existing SunReyChainService adapter.
 *
 * Translates HIN evidence into existing ChainWriteIntent schemas.
 * Does not reimplement hashing, classification, signing, or finality.
 * Does not mint, transfer ownership, or rewrite historical HIN records.
 */
export class HinChainAnchorAdapter implements HumanInformationChainAnchorPort {
  readonly engine: HumanInformationNetworkEngine;
  readonly chain: SunReyChainService;
  readonly rightsOwner = HIN_CHAIN_ANCHOR_OWNER.HIN_RIGHTS_OWNER;
  readonly chainOwner = HIN_CHAIN_ANCHOR_OWNER.CHAIN_OWNER;
  readonly invariants = HIN_CHAIN_ANCHOR_INVARIANTS;
  private readonly clock: Clock;
  private readonly contributionRegistry: HumanContributionRegistryPort | null;
  private readonly records = new Map<string, HumanInformationChainAnchorRecord>();
  private readonly keys = new Map<HumanInformationAnchorKey, HumanInformationAnchorId>();

  constructor(options: HinChainAnchorAdapterOptions) {
    this.engine = options.engine;
    this.chain = options.chain;
    this.clock = options.clock;
    this.contributionRegistry = options.contributionRegistry ?? null;
  }

  createAnchorIntent(request: HinAnchorRequest): Result<HumanInformationChainAnchorRecord, HinAnchorFailure> {
    if (!(HIN_ANCHOR_KINDS as readonly string[]).includes(request.kind)) {
      return err({
        code: 'HIN_ANCHOR_KIND_UNSUPPORTED',
        message: `anchor kind ${String(request.kind)} is not a HIN evidence class`,
      });
    }
    const privacy = assertPrivacySafeAnchorMaterial(request);
    if (!privacy.ok) {
      return privacy;
    }
    const prepared = this.prepare(request);
    if (!prepared.ok) {
      return prepared;
    }
    const key = humanInformationAnchorKey({
      kind: request.kind,
      sourceRecordId: prepared.value.sourceRecordId,
      sourceRecordVersion: prepared.value.sourceRecordVersion,
      payloadCommitment: commitRecordSchema(prepared.value.schema),
    });
    const existingId = this.keys.get(key);
    if (existingId) {
      const existing = this.records.get(existingId);
      if (existing) {
        return ok(existing);
      }
    }
    const created = this.chain.createIntent(prepared.value.intent);
    if (!created.ok) {
      return err(mapChainFailure(created.error.code, created.error.message));
    }
    const now = this.clock.now();
    const record: HumanInformationChainAnchorRecord = Object.freeze({
      anchorId: newAnchorId(),
      anchorKind: request.kind,
      sourceRecordId: prepared.value.sourceRecordId,
      sourceRecordVersion: prepared.value.sourceRecordVersion,
      chainRecordType: created.value.recordType,
      payloadCommitment: created.value.payloadCommitment,
      subjectReferenceCommitment: created.value.subjectReference?.commitment ?? null,
      intentId: created.value.intentId,
      operationId: created.value.operationId,
      transactionId: null,
      receiptId: null,
      blockReference: null,
      state: 'INTENT_CREATED',
      confirmations: 0,
      policyVersion: created.value.policyVersion,
      jurisdictionCell: created.value.jurisdictionCell,
      createdAt: now,
      updatedAt: now,
      rawSensitivePersonalInformation: false,
      transfersOwnership: false,
      createsMonetaryAuthority: false,
      mintsAsset: false,
    });
    this.records.set(record.anchorId, record);
    this.keys.set(key, record.anchorId);
    return ok(record);
  }

  submitAnchor(anchorId: HumanInformationAnchorId | string): Result<HumanInformationChainAnchorRecord, HinAnchorFailure> {
    const current = this.records.get(anchorId);
    if (!current || !current.intentId) {
      return err({ code: 'HIN_ANCHOR_SOURCE_NOT_FOUND', message: `anchor ${anchorId} has no stored intent` });
    }
    const submitted = this.chain.submit(current.intentId);
    if (!submitted.ok) {
      return err(mapChainFailure(submitted.error.code, submitted.error.message));
    }
    const next = this.project(current, submitted.value);
    this.records.set(next.anchorId, next);
    return ok(next);
  }

  anchorStatus(anchorId: HumanInformationAnchorId | string): HumanInformationChainAnchorRecord | undefined {
    const current = this.records.get(anchorId);
    if (!current) {
      return undefined;
    }
    if (!current.operationId) {
      return current;
    }
    const operation = this.chain.getOperation(current.operationId);
    if (!operation) {
      return current;
    }
    const next = this.project(current, operation);
    this.records.set(next.anchorId, next);
    return next;
  }

  reconcileAnchor(anchorId: HumanInformationAnchorId | string): Result<HumanInformationChainAnchorRecord, HinAnchorFailure> {
    const current = this.records.get(anchorId);
    if (!current) {
      return err({ code: 'HIN_ANCHOR_SOURCE_NOT_FOUND', message: `anchor ${anchorId} is unknown` });
    }
    if (!current.operationId) {
      return ok(current);
    }
    const reconciled = this.chain.reconcile(current.operationId);
    if (!reconciled.ok) {
      return err(mapChainFailure(reconciled.error.code, reconciled.error.message));
    }
    const operation = this.chain.getOperation(current.operationId);
    if (!operation) {
      return ok(current);
    }
    const next = this.project(current, operation);
    this.records.set(next.anchorId, next);
    return ok(next);
  }

  getIntent(anchorId: HumanInformationAnchorId | string): ChainWriteIntent | undefined {
    const record = this.records.get(anchorId);
    return record?.intentId ? this.chain.getIntent(record.intentId) : undefined;
  }

  listAnchors(): readonly HumanInformationChainAnchorRecord[] {
    return Object.freeze([...this.records.values()]);
  }

  finalizedRegistryAnchor(
    record: HumanInformationChainAnchorRecord,
    assetClass: EconomicAssetClass,
  ): EconomicAssetChainAnchor | null {
    return hinFinalizedAnchorForRegistry(record, assetClass);
  }

  private project(
    current: HumanInformationChainAnchorRecord,
    operation: ChainOperation,
  ): HumanInformationChainAnchorRecord {
    return Object.freeze({
      ...current,
      operationId: operation.operationId,
      transactionId: operation.transactionId,
      receiptId: operation.receiptId,
      blockReference: operation.blockReference,
      state: mapOperationState(operation),
      confirmations: operation.confirmations,
      updatedAt: this.clock.now(),
      rawSensitivePersonalInformation: false,
      transfersOwnership: false,
      createsMonetaryAuthority: false,
      mintsAsset: false,
    });
  }

  private prepare(request: HinAnchorRequest): Result<
    {
      readonly sourceRecordId: string;
      readonly sourceRecordVersion: string;
      readonly schema: ChainRecordSchema;
      readonly intent: CreateIntentInput;
    },
    HinAnchorFailure
  > {
    switch (request.kind) {
      case 'CONSENT_GRANT':
        return this.prepareConsent(request);
      case 'CONSENT_REVOCATION':
        return this.prepareRevocation(request);
      case 'INFORMATION_RIGHT_STATE':
        return this.prepareRight(request);
      case 'PURPOSE_GRANT':
        return this.preparePurpose(request);
      case 'USAGE_RECEIPT':
        return this.prepareUsage(request);
      case 'CLEAN_ROOM_COMPUTATION':
        return this.prepareComputation(request);
      case 'PROVENANCE':
        return this.prepareProvenance(request);
      case 'HUMAN_CONTRIBUTION_PROOF':
        return this.prepareContribution(request);
      case 'COMPENSATION_SETTLEMENT_REFERENCE':
        return this.prepareSettlement(request);
      default:
        return err({
          code: 'HIN_ANCHOR_KIND_UNSUPPORTED',
          message: `anchor kind ${String(request.kind)} is not supported`,
        });
    }
  }

  private prepareConsent(request: HinAnchorRequest) {
    const grant = this.engine.store.grants.get(request.sourceRecordId as never);
    if (!grant) {
      return err({ code: 'HIN_ANCHOR_SOURCE_NOT_FOUND', message: `consent grant ${request.sourceRecordId} was not found` });
    }
    const subject = this.scopeSubject({
      subjectId: grant.subjectId,
      recipientContext: grant.recipientClass,
      purpose: grant.purpose,
    });
    if (!subject.ok) {
      return subject;
    }
    const version = request.sourceRecordVersion ?? grant.policyVersion;
    const grantCommitment = consentCommitment({
      grantId: grant.grantId,
      consentHash: grant.consentHash,
      consentVersion: version,
      purpose: grant.purpose,
      policyVersion: grant.policyVersion,
    });
    const schema = buildConsentAnchorSchema({
      consentId: grantCommitment,
      consentVersion: version,
      consentHash: grant.consentHash,
      purposeId: sha256(grant.purpose),
      purposeVersion: grant.policyVersion,
      subjectReference: subject.value.reference.commitment,
      recipientClass: grant.recipientClass,
      scopeCommitment: sha256(`${grant.processingClass}:${grant.descriptorId}`),
      effectiveState: grant.status,
      expirationReference: sha256(grant.expiresAt),
      timestamp: grant.createdAt,
    });
    if (!schema.ok) {
      return schema;
    }
    return ok({
      sourceRecordId: grant.grantId,
      sourceRecordVersion: version,
      schema: schema.value,
      intent: this.intentInput({
        request,
        schema: schema.value,
        sourceRecordId: grant.grantId,
        purpose: 'hin-consent-anchor',
        subject: subject.value.scope,
      }),
    });
  }

  private prepareRevocation(request: HinAnchorRequest) {
    const revocation = this.engine.store.revocations.get(request.sourceRecordId);
    if (!revocation) {
      return err({
        code: 'HIN_ANCHOR_SOURCE_NOT_FOUND',
        message: `revocation ${request.sourceRecordId} was not found`,
      });
    }
    const grant = this.engine.store.grants.get(revocation.grantId);
    if (!grant) {
      return err({ code: 'HIN_ANCHOR_SOURCE_NOT_FOUND', message: 'revocation is not bound to a stored consent grant' });
    }
    const subject = this.scopeSubject({
      subjectId: revocation.subjectId,
      recipientContext: grant.recipientClass,
      purpose: grant.purpose,
    });
    if (!subject.ok) {
      return subject;
    }
    const version = request.sourceRecordVersion ?? grant.policyVersion;
    const schema = buildRevocationAnchorSchema({
      consentId: consentCommitment({
        grantId: grant.grantId,
        consentHash: grant.consentHash,
        consentVersion: version,
        purpose: grant.purpose,
        policyVersion: grant.policyVersion,
      }),
      consentVersion: version,
      revocationId: revocationCommitment({
        revocationId: revocation.revocationId,
        grantId: grant.grantId,
        consentHash: grant.consentHash,
        policyVersion: grant.policyVersion,
      }),
      subjectReference: subject.value.reference.commitment,
      revokedAt: revocation.revokedAt,
      priorReceiptCommitment: grant.consentHash,
    });
    if (!schema.ok) {
      return schema;
    }
    return ok({
      sourceRecordId: revocation.revocationId,
      sourceRecordVersion: version,
      schema: schema.value,
      intent: this.intentInput({
        request,
        schema: schema.value,
        sourceRecordId: revocation.revocationId,
        purpose: 'hin-revocation-anchor',
        subject: subject.value.scope,
      }),
    });
  }

  private prepareRight(request: HinAnchorRequest) {
    const right = this.engine.store.rights.get(request.sourceRecordId as never);
    if (!right) {
      return err({ code: 'HIN_ANCHOR_SOURCE_NOT_FOUND', message: `information right ${request.sourceRecordId} was not found` });
    }
    const grant = this.engine.store.grants.get(right.consentGrantId);
    const subject = this.scopeSubject({
      subjectId: right.subjectId,
      recipientContext: grant?.recipientClass ?? 'UNKNOWN',
      purpose: right.purpose,
    });
    if (!subject.ok) {
      return subject;
    }
    const version = request.sourceRecordVersion ?? `${right.policyVersion}:${right.status}`;
    const rightCommitment = rightStateCommitment({
      rightId: right.rightId,
      rightType: right.rightType,
      purpose: right.purpose,
      processingClass: right.processingClass,
      outputClass: right.outputClass,
      status: right.status,
      policyVersion: right.policyVersion,
      consentReference: right.consentGrantId,
      expiration: right.expiresAt,
    });
    const schema = buildRightStateAnchorSchema({
      rightCommitment,
      status: right.status,
      policyVersion: right.policyVersion,
      purposeCommitment: sha256(right.purpose),
      consentReference: grant?.consentHash ?? right.consentGrantId,
      expirationReference: sha256(right.expiresAt),
    });
    if (!schema.ok) {
      return schema;
    }
    return ok({
      sourceRecordId: right.rightId,
      sourceRecordVersion: version,
      schema: schema.value,
      intent: this.intentInput({
        request,
        schema: schema.value,
        sourceRecordId: right.rightId,
        purpose: 'hin-right-state-anchor',
        subject: subject.value.scope,
      }),
    });
  }

  private preparePurpose(request: HinAnchorRequest) {
    const purpose = this.engine.store.purposes.get(request.sourceRecordId);
    if (!purpose) {
      return err({
        code: 'HIN_ANCHOR_SOURCE_NOT_FOUND',
        message: `purpose grant ${request.sourceRecordId} was not found`,
      });
    }
    const grant = this.engine.store.grants.get(purpose.grantId);
    const subject = grant
      ? this.scopeSubject({
          subjectId: grant.subjectId,
          recipientContext: grant.recipientClass,
          purpose: purpose.purpose,
        })
      : err({
          code: 'HIN_ANCHOR_SUBJECT_SCOPE_REQUIRED',
          message: 'purpose grant anchoring requires a scoped subject reference',
        } satisfies HinAnchorFailure);
    if (!subject.ok) {
      return subject;
    }
    const version = request.sourceRecordVersion ?? `${this.engine.policy.policyVersion}:${purpose.status}`;
    const schema = buildPurposeGrantAnchorSchema({
      grantReference: purpose.purposeGrantId,
      purposeCommitment: purposeGrantCommitment({
        purposeGrantId: purpose.purposeGrantId,
        purpose: purpose.purpose,
        status: purpose.status,
        policyVersion: this.engine.policy.policyVersion,
      }),
      status: purpose.status,
      policyVersion: this.engine.policy.policyVersion,
    });
    if (!schema.ok) {
      return schema;
    }
    return ok({
      sourceRecordId: purpose.purposeGrantId,
      sourceRecordVersion: version,
      schema: schema.value,
      intent: this.intentInput({
        request,
        schema: schema.value,
        sourceRecordId: purpose.purposeGrantId,
        purpose: 'hin-purpose-grant-anchor',
        subject: subject.value.scope,
      }),
    });
  }

  private prepareUsage(request: HinAnchorRequest) {
    const receipt = this.engine.store.receipts.get(request.sourceRecordId);
    if (!receipt) {
      return err({
        code: 'HIN_ANCHOR_SOURCE_NOT_FOUND',
        message: `usage receipt ${request.sourceRecordId} was not found`,
      });
    }
    const right = this.engine.store.rights.get(receipt.rightId);
    const grant = right ? this.engine.store.grants.get(right.consentGrantId) : undefined;
    if (!right || !grant) {
      return err({
        code: 'HIN_ANCHOR_SOURCE_NOT_FOUND',
        message: 'usage receipt is not bound to a stored right and consent',
      });
    }
    const subject = this.scopeSubject({
      subjectId: right.subjectId,
      recipientContext: grant.recipientClass,
      purpose: receipt.purpose,
    });
    if (!subject.ok) {
      return subject;
    }
    const hasComputation = Boolean(receipt.computationId);
    const result = [...this.engine.store.results.values()].find((row) => row.purpose === receipt.purpose);
    const resultCommitment = result ? sha256(String(result.privacySafeValue)) : receipt.evidenceDigest;
    const version = request.sourceRecordVersion ?? receipt.policyVersion;
    const schema = buildUsageReceiptAnchorSchema({
      receiptHash: usageReceiptCommitment({
        receiptId: receipt.receiptId,
        usageReceiptHash: receipt.evidenceDigest,
        requesterId: receipt.requesterId,
        purpose: receipt.purpose,
        computationId: receipt.computationId,
        policyVersion: receipt.policyVersion,
        outputClass: receipt.outputClass,
      }),
      requesterReference: sha256(receipt.requesterId),
      purpose: sha256(receipt.purpose),
      privacyPolicyVersion: receipt.policyVersion,
      resultCommitment,
      timestamp: receipt.occurredAt,
      hasComputation,
      outputClass: receipt.outputClass,
    });
    if (!schema.ok) {
      return schema;
    }
    return ok({
      sourceRecordId: receipt.receiptId,
      sourceRecordVersion: version,
      schema: schema.value,
      intent: this.intentInput({
        request,
        schema: schema.value,
        sourceRecordId: receipt.receiptId,
        purpose: 'hin-usage-receipt-anchor',
        subject: subject.value.scope,
        recordType: chainRecordTypeFor('USAGE_RECEIPT', { hasComputation }),
      }),
    });
  }

  private prepareComputation(request: HinAnchorRequest) {
    const job = this.engine.store.jobs.get(request.sourceRecordId as never);
    if (!job) {
      return err({
        code: 'HIN_ANCHOR_SOURCE_NOT_FOUND',
        message: `clean-room computation ${request.sourceRecordId} was not found`,
      });
    }
    const result = [...this.engine.store.results.values()].find(
      (row) => row.computationRequestId === job.computationRequestId,
    );
    const approved = this.engine.store.computations.get(job.approvedComputationId);
    const firstRight = this.engine.store.rights.get(job.inputRightIds[0] as never);
    const grant = firstRight ? this.engine.store.grants.get(firstRight.consentGrantId) : undefined;
    const subject = firstRight
      ? this.scopeSubject({
          subjectId: firstRight.subjectId,
          recipientContext: grant?.recipientClass ?? job.requesterId,
          purpose: job.purpose,
        })
      : err({
          code: 'HIN_ANCHOR_SUBJECT_SCOPE_REQUIRED',
          message: 'clean-room anchoring requires a scoped subject reference',
        } satisfies HinAnchorFailure);
    if (!subject.ok) {
      return subject;
    }
    const resultCommitment = result ? sha256(`result:${result.resultId}:${result.outputClass}`) : sha256(job.evidenceDigest);
    const version = request.sourceRecordVersion ?? job.privacyPolicyVersion;
    const schema = buildComputationAnchorSchema({
      receiptHash: computationCommitment({
        computationRequestId: sha256(job.computationRequestId),
        approvedComputationHash: approved?.artifactDigest ?? job.policy.computationHash,
        inputRightSet: sha256(job.inputRightIds.join(',')),
        privacyPolicyVersion: job.privacyPolicyVersion,
        resultCommitment,
        outputClass: job.outputClass,
        cohortPolicy: `minCohort:${String(job.policy.minCohortSize)}`,
      }),
      requesterReference: sha256(job.requesterId),
      purpose: sha256(job.purpose),
      privacyPolicyVersion: job.privacyPolicyVersion,
      resultCommitment,
      timestamp: result?.createdAt ?? job.expiresAt,
    });
    if (!schema.ok) {
      return schema;
    }
    return ok({
      sourceRecordId: job.computationRequestId,
      sourceRecordVersion: version,
      schema: schema.value,
      intent: this.intentInput({
        request,
        schema: schema.value,
        sourceRecordId: job.computationRequestId,
        purpose: 'hin-clean-room-anchor',
        subject: subject.value.scope,
      }),
    });
  }

  private prepareProvenance(request: HinAnchorRequest) {
    const provenance = this.engine.store.provenance.get(request.sourceRecordId);
    const descriptor = this.engine.store.descriptors.get(request.sourceRecordId as never);
    if (!provenance || !descriptor) {
      return err({
        code: 'HIN_ANCHOR_SOURCE_NOT_FOUND',
        message: `provenance ${request.sourceRecordId} was not found`,
      });
    }
    const subject = this.scopeSubject({
      subjectId: descriptor.subjectId,
      recipientContext: 'HIN_DESCRIPTOR',
      purpose: 'hin-provenance-anchor',
    });
    if (!subject.ok) {
      return subject;
    }
    const version = request.sourceRecordVersion ?? descriptor.schema;
    const schema = buildProvenanceAnchorSchema({
      sourceCommitment: provenanceCommitment({
        source: provenance.source,
        collectionAuthority: provenance.collectionAuthority,
        timestamp: provenance.timestamp,
        transforms: provenance.transforms.join(','),
      }),
      transformationReference: sha256(provenance.transforms.join('|')),
      authorizationReference: sha256(provenance.collectionAuthority),
      outputCommitment: sha256(descriptor.descriptorId),
    });
    if (!schema.ok) {
      return schema;
    }
    return ok({
      sourceRecordId: descriptor.descriptorId,
      sourceRecordVersion: version,
      schema: schema.value,
      intent: this.intentInput({
        request,
        schema: schema.value,
        sourceRecordId: descriptor.descriptorId,
        purpose: 'hin-provenance-anchor',
        subject: subject.value.scope,
      }),
    });
  }

  private prepareContribution(request: HinAnchorRequest) {
    const contributionId = request.contributionId ?? request.sourceRecordId;
    const recorded = this.contributionRegistry?.getById(contributionId);
    if (!recorded || recorded.status !== 'VERIFIED') {
      return err({
        code: 'HIN_ANCHOR_CONTRIBUTION_NOT_VERIFIED',
        message: 'contribution proof may be anchored only after the canonical contribution is verified',
      });
    }
    const receipt = this.engine.store.receipts.get(recorded.evidence.usageReceiptId);
    const right = receipt ? this.engine.store.rights.get(receipt.rightId) : undefined;
    if (!right) {
      return err({
        code: 'HIN_ANCHOR_SOURCE_NOT_FOUND',
        message: 'verified contribution is not bound to a stored information right',
      });
    }
    const grant = this.engine.store.grants.get(right.consentGrantId);
    const subject = this.scopeSubject({
      subjectId: right.subjectId,
      recipientContext: grant?.recipientClass ?? 'CONTRIBUTION',
      purpose: recorded.evidence.purposeRef,
    });
    if (!subject.ok) {
      return subject;
    }
    const version = request.sourceRecordVersion ?? recorded.verifiedAt;
    const schema = buildContributionProofAnchorSchema({
      contributionCommitment: contributionProofCommitment({
        contributionId: recorded.contributionId,
        fingerprint: recorded.evidence.evidenceDigest,
        verificationDecision: recorded.status,
        rightEvidence: recorded.evidence.rightId,
        purpose: recorded.evidence.purposeRef,
        usageReceiptId: recorded.evidence.usageReceiptId,
      }),
      subjectReference: subject.value.reference.commitment,
      purpose: recorded.evidence.purposeRef,
      receiptReference: recorded.evidence.usageReceiptId,
    });
    if (!schema.ok) {
      return schema;
    }
    return ok({
      sourceRecordId: recorded.contributionId,
      sourceRecordVersion: version,
      schema: schema.value,
      intent: this.intentInput({
        request,
        schema: schema.value,
        sourceRecordId: recorded.contributionId,
        purpose: 'hin-contribution-proof-anchor',
        subject: subject.value.scope,
      }),
    });
  }

  private prepareSettlement(request: HinAnchorRequest) {
    const instruction = this.engine.store.compensation.get(request.sourceRecordId as never);
    if (!instruction) {
      return err({
        code: 'HIN_ANCHOR_SOURCE_NOT_FOUND',
        message: `compensation instruction ${request.sourceRecordId} was not found`,
      });
    }
    const canonical = request.canonicalSettlement;
    if (
      !canonical ||
      !canonical.journalId ||
      !canonical.transferId ||
      !canonical.assetCommitment ||
      canonical.journalId === instruction.settlementRef
    ) {
      return err({
        code: 'HIN_ANCHOR_SETTLEMENT_NOT_CANONICAL',
        message: 'HIN may only reference an existing canonical settlement; it cannot invent settlementRef',
      });
    }
    if (instruction.mintRequested !== false || instruction.unrestrictedIssuance !== false) {
      return err({
        code: 'HIN_ANCHOR_SETTLEMENT_NOT_CANONICAL',
        message: 'HIN compensation cannot mint and cannot become monetary authority',
      });
    }
    const subject = this.scopeSubject({
      subjectId: instruction.subjectId,
      recipientContext: instruction.requesterId,
      purpose: 'hin-settlement-reference',
    });
    if (!subject.ok) {
      return subject;
    }
    const version = request.sourceRecordVersion ?? instruction.monetaryAuthority;
    const schema = buildSettlementReferenceAnchorSchema({
      journalId: canonical.journalId,
      transferId: canonical.transferId,
      assetCommitment: canonical.assetCommitment,
    });
    if (!schema.ok) {
      return schema;
    }
    return ok({
      sourceRecordId: instruction.instructionId,
      sourceRecordVersion: version,
      schema: schema.value,
      intent: this.intentInput({
        request,
        schema: schema.value,
        sourceRecordId: instruction.instructionId,
        purpose: 'hin-settlement-reference-anchor',
        subject: subject.value.scope,
      }),
    });
  }

  private scopeSubject(input: {
    readonly subjectId: string;
    readonly recipientContext: string;
    readonly purpose: string;
  }): Result<{ readonly scope: HinSubjectScope; readonly reference: ScopedSubjectReference }, HinAnchorFailure> {
    const subject = this.engine.store.subjects.get(input.subjectId as never);
    if (!subject || !input.recipientContext || !input.purpose) {
      return err({
        code: 'HIN_ANCHOR_SUBJECT_SCOPE_REQUIRED',
        message: 'a scoped subject reference is required; raw HumanInformationSubjectId is not written on chain',
      });
    }
    const requester = [...this.engine.store.requesters.values()].find((row) => row.requesterClass === input.recipientContext);
    const scope: HinSubjectScope = {
      rawSubjectId: subject.internalRef,
      recipientContext: input.recipientContext,
      purpose: input.purpose,
      jurisdictionCell: requester?.jurisdiction ? `${requester.jurisdiction}:SIM` : 'GB:SIM',
      keyVersion: 1,
    };
    const reference = this.chain.createSubjectReference({
      kind: 'PSEUDONYMOUS_SUBJECT_REFERENCE',
      ...scope,
    });
    return ok({ scope, reference });
  }

  private intentInput(input: {
    readonly request: HinAnchorRequest;
    readonly schema: ChainRecordSchema;
    readonly sourceRecordId: string;
    readonly purpose: string;
    readonly subject: HinSubjectScope;
    readonly recordType?: CreateIntentInput['recordType'];
  }): CreateIntentInput {
    return {
      recordType: input.recordType ?? chainRecordTypeFor(input.request.kind),
      sourceSubsystem: 'information-market',
      sourceRecordReference: input.sourceRecordId,
      purpose: input.purpose,
      schema: input.schema,
      policyVersion: this.engine.policy.policyVersion,
      jurisdictionCell: input.subject.jurisdictionCell,
      correlationId: `hin-anchor:${input.request.kind}:${input.sourceRecordId}`,
      subject: {
        kind: 'PSEUDONYMOUS_SUBJECT_REFERENCE',
        rawSubjectId: input.subject.rawSubjectId,
        recipientContext: input.subject.recipientContext,
        purpose: input.subject.purpose,
        jurisdictionCell: input.subject.jurisdictionCell,
        keyVersion: input.subject.keyVersion,
      },
    };
  }
}

export function createHinChainAnchorAdapter(options: HinChainAnchorAdapterOptions): HinChainAnchorAdapter {
  return new HinChainAnchorAdapter(options);
}

export function hinFinalizedAnchorForRegistry(
  record: HumanInformationChainAnchorRecord,
  assetClass: EconomicAssetClass,
): EconomicAssetChainAnchor | null {
  if (record.state !== 'FINALIZED') {
    return null;
  }
  if (
    assetClass !== 'INFORMATION_ASSET' &&
    assetClass !== 'INFORMATION_RIGHT' &&
    assetClass !== 'HUMAN_CONTRIBUTION_EVIDENCE'
  ) {
    return null;
  }
  return {
    networkId: networkIdFor('sunrey-simulation'),
    chainId: chainIdFor('net_sunrey_simulation'),
    transactionId: null,
    blockHeight: null,
    blockId: null,
    stateRootRef: null,
    contentCommitment: contentCommitmentFor(record.payloadCommitment),
    anchorType:
      assetClass === 'INFORMATION_RIGHT'
        ? 'RIGHTS_COMMITMENT'
        : assetClass === 'HUMAN_CONTRIBUTION_EVIDENCE'
          ? 'CONTRIBUTION_COMMITMENT'
          : 'DESCRIPTOR_COMMITMENT',
    finalityState: 'FINALIZED_ON_SIMULATION',
  };
}
