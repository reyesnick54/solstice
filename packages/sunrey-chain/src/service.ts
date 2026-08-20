import type { Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import type { KeyProvider } from '../../security/src/provider.ts';
import { adapterMethodFor, type SunReyChainAdapter } from './adapter.ts';
import { classifyWrite } from './classification.ts';
import { commitRecordSchema, scopedSubjectCommitment } from './hash.ts';
import {
  newChainCommitmentId,
  newChainOperationId,
  newChainReconciliationId,
  newChainWriteIntentId,
  SIMULATION_ADAPTER_ID,
  SIMULATION_CHAIN_ID,
  SIMULATION_NETWORK_ID,
  type ChainOperationId,
  type ChainSubjectReference,
  type ChainWriteIntentId,
} from './ids.ts';
import { SimulationChainAdapter } from './simulation.ts';
import { signChainIntent } from './signer.ts';
import { InMemorySunReyChainStore } from './store.ts';
import {
  ENGINEERING_FINALITY_POLICY,
  EVIDENCE_KIND_SUNREY_CHAIN,
  INITIAL_CHAIN_NETWORK_MODE,
  type ChainRecordType,
  type ReconciliationOutcome,
  type SourceSubsystem,
  type SubjectReferenceKind,
} from './taxonomy.ts';
import type {
  AttestationAnchorStatus,
  ChainFailure,
  ChainHealth,
  ChainOperation,
  ChainOperationStatus,
  ChainRecordProjection,
  ChainRecordSchema,
  ChainWriteIntent,
  ConsentAnchorStatus,
  ReconciliationRecord,
  ScopedSubjectReference,
  SettlementAnchorStatus,
} from './types.ts';

export type CreateIntentInput = {
  readonly recordType: ChainRecordType;
  readonly sourceSubsystem: SourceSubsystem;
  readonly sourceRecordReference: string;
  readonly purpose: string;
  readonly schema: ChainRecordSchema;
  readonly policyVersion: string;
  readonly jurisdictionCell: string;
  readonly correlationId: string;
  readonly expiresAt?: ChainWriteIntent['expiresAt'];
  readonly subject?: {
    readonly kind: SubjectReferenceKind;
    readonly rawSubjectId: string;
    readonly recipientContext: string;
    readonly purpose: string;
    readonly jurisdictionCell: string;
    readonly keyVersion: number;
  };
};

export class SunReyChainService {
  private readonly clock: Clock;
  private readonly keys: KeyProvider;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly adapter: SimulationChainAdapter;
  private readonly store: InMemorySunReyChainStore;
  private readonly networkMode = INITIAL_CHAIN_NETWORK_MODE;
  private readonly enabled = true;

  constructor(options: {
    readonly clock: Clock;
    readonly keys: KeyProvider;
    readonly evidence: EvidenceVault;
    readonly events: DomainEventLog;
    readonly adapter?: SimulationChainAdapter;
  }) {
    this.clock = options.clock;
    this.keys = options.keys;
    this.evidence = options.evidence;
    this.events = options.events;
    this.adapter = options.adapter ?? new SimulationChainAdapter(options.clock);
    this.store = new InMemorySunReyChainStore(options.clock.now());
  }

  get simulationAdapter(): SimulationChainAdapter {
    return this.adapter;
  }

  get port(): SunReyChainAdapter {
    return this.adapter;
  }

  createSubjectReference(input: NonNullable<CreateIntentInput['subject']>): ScopedSubjectReference {
    const commitment = scopedSubjectCommitment(input);
    return {
      referenceId: `csr_${commitment.slice(0, 16)}` as ChainSubjectReference,
      kind: input.kind,
      recipientContext: input.recipientContext,
      purpose: input.purpose,
      jurisdictionCell: input.jurisdictionCell,
      keyVersion: input.keyVersion,
      commitment,
    };
  }

  createIntent(input: CreateIntentInput): Result<ChainWriteIntent, ChainFailure> {
    const classified = classifyWrite({
      recordType: input.recordType,
      dataClass: input.schema.dataClass,
      schema: input.schema,
    });
    if (classified) {
      this.seal('intent.denied', { code: classified.code, recordType: input.recordType });
      return err(classified);
    }
    const payloadCommitment = commitRecordSchema(input.schema);
    const subjectReference = input.subject ? this.createSubjectReference(input.subject) : null;
    const intent: ChainWriteIntent = {
      intentId: newChainWriteIntentId(),
      operationId: newChainOperationId(),
      recordType: input.recordType,
      sourceSubsystem: input.sourceSubsystem,
      sourceRecordReference: input.sourceRecordReference,
      subjectReference,
      purpose: input.purpose,
      payloadCommitment,
      schema: input.schema,
      dataClass: 'ON_CHAIN_SAFE',
      policyVersion: input.policyVersion,
      jurisdictionCell: input.jurisdictionCell,
      createdAt: this.clock.now(),
      expiresAt: input.expiresAt ?? null,
      correlationId: input.correlationId,
      economicValueMovement: false,
    };
    this.store.intents.set(intent.intentId, intent);
    this.emit('SunReyChainIntentCreated', {
      intentId: intent.intentId,
      operationId: intent.operationId,
      recordType: intent.recordType,
      correlationId: intent.correlationId,
    });
    this.seal('intent.created', {
      intentId: intent.intentId,
      sourceSubsystem: intent.sourceSubsystem,
      sourceRecordReference: intent.sourceRecordReference,
      payloadCommitment,
      adapter: SIMULATION_ADAPTER_ID,
    });
    return ok(intent);
  }

  submit(intentId: ChainWriteIntentId): Result<ChainOperation, ChainFailure> {
    const intent = this.store.intents.get(intentId);
    if (!intent) {
      return err({ code: 'INTENT_NOT_FOUND', message: 'write intent does not exist' });
    }
    const existing = [...this.store.operations.values()].find((row) => row.intentId === intentId);
    if (existing) {
      if (existing.state === 'UNKNOWN' || existing.unknownAfterBroadcast) {
        return err({
          code: 'CHAIN_SUBMISSION_UNKNOWN',
          message: 'query or reconcile before any resubmit',
        });
      }
      return ok(existing);
    }
    const gated = this.policyGate(intent);
    if (gated) {
      this.seal('policy.denied', { intentId, code: gated.code });
      return err(gated);
    }
    const signed = signChainIntent(this.keys, intent);
    if (!signed.ok) {
      return err(signed.error);
    }
    const method = adapterMethodFor(intent.recordType);
    const submitted = this.adapter[method](intent);
    const now = this.clock.now();
    if (submitted.outcome === 'UNAVAILABLE') {
      this.store.health = this.adapter.getHealth();
      this.emit('SunReyChainHealthDegraded', { status: this.store.health.status, reason: submitted.reason });
      return err({ code: 'CHAIN_UNAVAILABLE', message: submitted.reason });
    }
    if (submitted.outcome === 'REJECTED') {
      const operation = this.recordOperation(intent, {
        state: 'REJECTED',
        transactionId: null,
        receiptId: null,
        blockReference: null,
        confirmations: 0,
        signature: signed.signature,
        unknownAfterBroadcast: false,
        updatedAt: now,
      });
      return ok(operation);
    }
    if (submitted.outcome === 'UNKNOWN') {
      const operation = this.recordOperation(intent, {
        state: 'UNKNOWN',
        transactionId: submitted.transactionId,
        receiptId: null,
        blockReference: null,
        confirmations: 0,
        signature: signed.signature,
        unknownAfterBroadcast: true,
        updatedAt: now,
      });
      this.emit('SunReyChainOperationUnknown', {
        operationId: operation.operationId,
        correlationId: intent.correlationId,
      });
      this.seal('operation.unknown', {
        operationId: operation.operationId,
        intentId,
        payloadCommitment: intent.payloadCommitment,
      });
      return ok(operation);
    }
    const operation = this.recordOperation(intent, {
      state: submitted.state,
      transactionId: submitted.transactionId,
      receiptId: submitted.receiptId,
      blockReference: submitted.blockReference,
      confirmations: 0,
      signature: signed.signature,
      unknownAfterBroadcast: false,
      updatedAt: now,
    });
    const receipt = this.adapter.getReceipt(submitted.receiptId);
    if (receipt) {
      this.store.receipts.set(receipt.receiptId, receipt);
    }
    this.emit('SunReyChainOperationSubmitted', {
      operationId: operation.operationId,
      recordType: intent.recordType,
      correlationId: intent.correlationId,
    });
    this.seal('operation.submitted', {
      operationId: operation.operationId,
      intentId,
      adapter: SIMULATION_ADAPTER_ID,
      receiptId: submitted.receiptId,
      payloadCommitment: intent.payloadCommitment,
      keyId: signed.signature.keyId,
      keyVersion: signed.signature.keyVersion,
    });
    return ok(operation);
  }

  advanceFinality(blocks: number = ENGINEERING_FINALITY_POLICY.minimumConfirmations): void {
    this.adapter.advanceBlocks(blocks);
    for (const operation of this.store.operations.values()) {
      const finality = this.adapter.getFinality(operation.operationId);
      const next: ChainOperation = {
        ...operation,
        state: finality.state,
        confirmations: finality.confirmations,
        blockReference: finality.blockReference,
        updatedAt: this.clock.now(),
      };
      this.store.operations.set(operation.operationId, next);
      if (next.receiptId) {
        const receipt = this.adapter.getReceipt(next.receiptId);
        if (receipt) {
          this.store.receipts.set(receipt.receiptId, receipt);
        }
      }
      if (finality.state === 'FINALIZED' && operation.state !== 'FINALIZED') {
        this.emit('SunReyChainOperationFinalized', {
          operationId: next.operationId,
          correlationId: next.correlationId,
        });
        this.emit('SunReyChainAnchorRecorded', {
          operationId: next.operationId,
          recordType: next.recordType,
        });
        this.seal('operation.finalized', {
          operationId: next.operationId,
          receiptId: next.receiptId,
          payloadCommitment: next.payloadCommitment,
        });
      }
    }
    this.store.health = this.adapter.getHealth();
  }

  observeReorg(operationId: ChainOperationId): Result<ChainOperation, ChainFailure> {
    const operation = this.store.operations.get(operationId);
    if (!operation) {
      return err({ code: 'OPERATION_NOT_FOUND', message: 'operation does not exist' });
    }
    this.adapter.observeReorg(operationId);
    const next: ChainOperation = {
      ...operation,
      state: 'REORG_OBSERVED',
      updatedAt: this.clock.now(),
    };
    this.store.operations.set(operationId, next);
    if (next.receiptId) {
      const receipt = this.adapter.getReceipt(next.receiptId);
      if (receipt) {
        this.store.receipts.set(receipt.receiptId, receipt);
      }
    }
    this.emit('SunReyChainAnchorReorgObserved', { operationId, correlationId: next.correlationId });
    this.seal('anchor.reorg_observed', {
      operationId,
      payloadCommitment: next.payloadCommitment,
      financialStateRewritten: false,
    });
    return ok(next);
  }

  reconcile(operationId: ChainOperationId): Result<ReconciliationRecord, ChainFailure> {
    const operation = this.store.operations.get(operationId);
    const intent = operation ? this.store.intents.get(operation.intentId) : undefined;
    if (!operation || !intent) {
      return err({ code: 'OPERATION_NOT_FOUND', message: 'cannot reconcile missing operation' });
    }
    const finality = this.adapter.getFinality(operationId);
    let outcome: ReconciliationOutcome = 'PENDING';
    let notes = 'awaiting finality';
    if (operation.state === 'UNKNOWN' || operation.unknownAfterBroadcast) {
      outcome = 'SUBMISSION_UNKNOWN';
      notes = 'query before resubmit; adapter idempotency not proven for a new operation id';
    } else if (operation.state === 'REORG_OBSERVED' || finality.state === 'REORG_OBSERVED') {
      outcome = 'REORG_OBSERVED';
      notes = 'canonical ledger unchanged; re-anchor only if separately authorized';
    } else if (!this.store.intents.has(operation.intentId)) {
      outcome = 'MISSING_INTERNAL_RECORD';
      notes = 'chain row without internal intent';
    } else if (finality.state === 'UNKNOWN' && operation.state !== 'CREATED') {
      outcome = 'MISSING_CHAIN_RECORD';
      notes = 'internal intent has no adapter record';
    } else if (operation.receiptId) {
      const receipt = this.adapter.getReceipt(operation.receiptId);
      if (receipt && receipt.payloadCommitment !== intent.payloadCommitment) {
        outcome = 'HASH_MISMATCH';
        notes = 'source commitment and chain receipt commitment differ';
      } else if (finality.state === 'FINALIZED' && receipt) {
        outcome = 'MATCHED';
        notes = 'source, intent, adapter, receipt, and finality agree';
      }
    }
    if (outcome === 'HASH_MISMATCH' || outcome === 'MISSING_CHAIN_RECORD' || outcome === 'MISSING_INTERNAL_RECORD') {
      this.emit('SunReyChainReconciliationMismatch', { operationId, outcome });
    }
    const record: ReconciliationRecord = {
      reconciliationId: newChainReconciliationId(),
      operationId,
      outcome,
      sourceRecordReference: intent.sourceRecordReference,
      intentCommitment: intent.payloadCommitment,
      chainCommitment: operation.payloadCommitment,
      notes,
      autoFixed: false,
      createdAt: this.clock.now(),
    };
    this.store.reconciliations.push(record);
    this.seal('reconciliation', {
      operationId,
      outcome,
      autoFixed: false,
    });
    return ok(record);
  }

  getOperation(operationId: ChainOperationId): ChainOperation | undefined {
    return this.store.operations.get(operationId);
  }

  getIntent(intentId: ChainWriteIntentId): ChainWriteIntent | undefined {
    return this.store.intents.get(intentId);
  }

  operationStatus(operationId: ChainOperationId): ChainOperationStatus | undefined {
    const operation = this.store.operations.get(operationId);
    if (!operation) {
      return undefined;
    }
    return {
      operationId: operation.operationId,
      state: operation.state,
      recordType: operation.recordType,
      payloadCommitment: operation.payloadCommitment,
      confirmations: operation.confirmations,
      unknownAfterBroadcast: operation.unknownAfterBroadcast,
    };
  }

  recordProjection(operationId: ChainOperationId): ChainRecordProjection | undefined {
    const operation = this.store.operations.get(operationId);
    const intent = operation ? this.store.intents.get(operation.intentId) : undefined;
    if (!operation || !intent) {
      return undefined;
    }
    const revoked = [...this.store.intents.values()].some(
      (row) =>
        row.recordType === 'CONSENT_REVOCATION' &&
        row.sourceRecordReference === intent.sourceRecordReference,
    );
    return {
      commitmentId: newChainCommitmentId(),
      recordType: intent.recordType,
      payloadCommitment: intent.payloadCommitment,
      active: intent.recordType === 'CONSENT_RECEIPT' ? !revoked && operation.state === 'FINALIZED' : operation.state === 'FINALIZED',
      supersededBy: null,
    };
  }

  consentAnchorStatus(consentId: string): ConsentAnchorStatus {
    const receipts = [...this.store.intents.values()].filter(
      (row) => row.recordType === 'CONSENT_RECEIPT' && row.sourceRecordReference === consentId,
    );
    const revocations = [...this.store.intents.values()].filter(
      (row) => row.recordType === 'CONSENT_REVOCATION' && row.schema.fields.consentId === consentId,
    );
    return {
      consentId,
      receiptCommitment: receipts.at(-1)?.payloadCommitment ?? null,
      revocationCommitment: revocations.at(-1)?.payloadCommitment ?? null,
      projectedActive: receipts.length > 0 && revocations.length === 0,
    };
  }

  attestationAnchorStatus(sourceRef: string): AttestationAnchorStatus | undefined {
    const intent = [...this.store.intents.values()].find(
      (row) => row.recordType === 'ATTESTATION' && row.sourceRecordReference === sourceRef,
    );
    if (!intent) {
      return undefined;
    }
    return {
      attestationId: sourceRef,
      commitment: intent.payloadCommitment,
      revocationState: String(intent.schema.fields.revocationState ?? 'ACTIVE'),
    };
  }

  settlementAnchorStatus(journalId: string): SettlementAnchorStatus | undefined {
    const intent = [...this.store.intents.values()].find(
      (row) =>
        row.recordType === 'DIGITAL_ASSET_SETTLEMENT' && row.schema.fields.journalId === journalId,
    );
    const operation = intent
      ? [...this.store.operations.values()].find((row) => row.intentId === intent.intentId)
      : undefined;
    if (!intent) {
      return undefined;
    }
    return {
      anchorId: intent.sourceRecordReference,
      journalId: String(intent.schema.fields.journalId),
      transferId: String(intent.schema.fields.transferId),
      chainState: operation?.state ?? 'CREATED',
      authoritativeBalanceSource: 'canonical-internal-ledger',
    };
  }

  getHealth(): ChainHealth {
    this.store.health = this.adapter.getHealth();
    return this.store.health;
  }

  snapshot() {
    return this.store.snapshot();
  }

  private policyGate(intent: ChainWriteIntent): ChainFailure | null {
    if (!this.enabled) {
      return { code: 'CAPABILITY_DISABLED', message: 'SunRey Chain capability is disabled' };
    }
    if (this.networkMode !== 'SIMULATION') {
      return { code: 'NETWORK_MODE_DENIED', message: 'only SIMULATION mode is enabled' };
    }
    if (intent.jurisdictionCell.length === 0) {
      return { code: 'JURISDICTION_REQUIRED', message: 'jurisdiction/cell is required' };
    }
    const classified = classifyWrite({
      recordType: intent.recordType,
      dataClass: intent.dataClass,
      schema: intent.schema,
    });
    if (classified) {
      return classified;
    }
    if (intent.sourceRecordReference.length === 0) {
      return { code: 'SOURCE_RECORD_INVALID', message: 'source record reference is required' };
    }
    if (commitRecordSchema(intent.schema) !== intent.payloadCommitment) {
      return { code: 'COMMITMENT_INVALID', message: 'payload commitment does not match schema' };
    }
    const health = this.adapter.getHealth();
    if (health.status === 'UNAVAILABLE' || health.status === 'MAINTENANCE') {
      return { code: 'CHAIN_UNAVAILABLE', message: health.reason ?? 'chain health forbids submit' };
    }
    if (!(ENGINEERING_FINALITY_POLICY.acceptableHealth as readonly string[]).includes(health.status)) {
      return { code: 'CHAIN_HEALTH_DENIED', message: `health ${health.status} is not acceptable` };
    }
    return null;
  }

  private recordOperation(
    intent: ChainWriteIntent,
    patch: Omit<ChainOperation, 'operationId' | 'intentId' | 'adapterId' | 'chainId' | 'networkId' | 'networkMode' | 'recordType' | 'commitmentId' | 'payloadCommitment' | 'createdAt' | 'correlationId'>,
  ): ChainOperation {
    const operation: ChainOperation = {
      operationId: intent.operationId,
      intentId: intent.intentId,
      adapterId: SIMULATION_ADAPTER_ID,
      chainId: SIMULATION_CHAIN_ID,
      networkId: SIMULATION_NETWORK_ID,
      networkMode: this.networkMode,
      recordType: intent.recordType,
      commitmentId: newChainCommitmentId(),
      payloadCommitment: intent.payloadCommitment,
      createdAt: intent.createdAt,
      correlationId: intent.correlationId,
      ...patch,
    };
    this.store.operations.set(operation.operationId, operation);
    return operation;
  }

  private emit(eventType: string, payload: Record<string, unknown>): void {
    this.events.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload,
    });
  }

  private seal(kind: string, payload: Record<string, unknown>): void {
    this.evidence.seal(`${EVIDENCE_KIND_SUNREY_CHAIN}:${kind}`, {
      ...payload,
      kind,
      simulation: true,
      rawDataIncluded: false,
      privateKeyIncluded: false,
    });
  }
}
