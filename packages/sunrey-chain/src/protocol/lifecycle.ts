// @ts-nocheck
/**
 * Secure transaction lifecycle orchestration.
 *
 * creation → signing → submission → stateless validation → stateful validation
 * → mempool → block inclusion → execution → finalization
 *
 * No unsigned or replayed transaction may modify canonical monetary state.
 */

import { err, ok, type Result } from '../../../domain/src/result.ts';
import { signEnvelope, verifyEnvelopeSignature } from './authentication.ts';
import { encodeEnvelope } from './codec.ts';
import type { EnvelopeV1 } from './envelope.ts';
import { bodyHeaderOf } from './envelope.ts';
import { transactionIdOf } from './hash.ts';
import { ConsumedAuthorizationRegistry, extractIssuanceAuthorization } from './issuance-replay.ts';
import { ProtocolMempool, contextNowMs } from './mempool.ts';
import type { ProtocolRejection } from './rejection.ts';
import { advanceReceipt, receiptForStage, type TransactionReceipt } from './receipt.ts';
import { transactionSigningDigestHex } from './signing.ts';
import { ProtocolState, type ProtocolExecutionContext, type StateTransitionResult } from './state.ts';
import {
  decode,
  processTransaction,
  validateAuthentication,
  validateEnvelope,
  validateReplay,
  validateStateless,
} from './validation.ts';

export type SignedTransaction = {
  readonly envelope: EnvelopeV1;
  readonly transactionId: string;
  readonly canonicalBytes: Uint8Array;
  readonly signingDigestHex: string;
};

export type LifecycleRejection = ProtocolRejection | { readonly code: 'UNSIGNED' | 'CROSS_ASSET' | 'DUPLICATE_ISSUANCE' | 'UNAUTHORIZED_ISSUANCE'; readonly stage: string };

export class TransactionLifecycle {
  readonly state: ProtocolState;
  readonly mempool: ProtocolMempool;
  readonly issuanceRegistry: ConsumedAuthorizationRegistry;
  readonly context: ProtocolExecutionContext;
  private readonly receipts = new Map<string, TransactionReceipt>();

  constructor(
    context: ProtocolExecutionContext,
    state?: ProtocolState,
    mempool?: ProtocolMempool,
    issuanceRegistry?: ConsumedAuthorizationRegistry,
  ) {
    this.context = context;
    this.state = state ?? new ProtocolState();
    this.mempool = mempool ?? new ProtocolMempool();
    this.issuanceRegistry = issuanceRegistry ?? new ConsumedAuthorizationRegistry();
  }

  createUnsigned(envelope: EnvelopeV1): Result<EnvelopeV1, LifecycleRejection> {
    const checked = validateEnvelope(envelope, this.context);
    if (!checked.ok) {
      return checked;
    }
    const stateless = validateStateless(checked.value);
    if (!stateless.ok) {
      return stateless;
    }
    const txId = transactionIdOf(stateless.value);
    this.receipts.set(
      txId,
      receiptForStage({
        transactionId: txId,
        stage: 'CREATED',
        source: 'STATELESS_VALIDATION',
      }),
    );
    return ok(stateless.value);
  }

  sign(envelope: EnvelopeV1, seed: Uint8Array): Result<SignedTransaction, LifecycleRejection> {
    const unsigned = this.createUnsigned(envelope);
    if (!unsigned.ok) {
      return unsigned;
    }
    const signed = signEnvelope(unsigned.value, seed);
    const txId = transactionIdOf(signed);
    this.receipts.set(
      txId,
      receiptForStage({
        transactionId: txId,
        stage: 'SIGNED',
        source: 'AUTHENTICATION',
      }),
    );
    return ok(
      Object.freeze({
        envelope: signed,
        transactionId: txId,
        canonicalBytes: encodeEnvelope(signed),
        signingDigestHex: transactionSigningDigestHex(signed),
      }),
    );
  }

  submit(signed: SignedTransaction): Result<TransactionReceipt, LifecycleRejection> {
    if (!verifyEnvelopeSignature(signed.envelope)) {
      return err({ code: 'UNSIGNED', stage: 'submit' });
    }
    const crossAsset = this.rejectCrossAssetMutation(signed.envelope);
    if (crossAsset) {
      return err(crossAsset);
    }
    const issuance = this.guardIssuanceReplay(signed.envelope);
    if (issuance) {
      return err(issuance);
    }

    const admission = this.mempool.admit(
      signed.canonicalBytes,
      this.state,
      this.context,
      contextNowMs(this.context),
    );
    if (!admission.ok) {
      const receipt = receiptForStage({
        transactionId: signed.transactionId,
        stage: 'REJECTED',
        source: 'MEMPOOL_ADMISSION',
        rejectionCode: admission.reason,
      });
      this.receipts.set(signed.transactionId, receipt);
      return err({ code: admission.reason as ProtocolRejection['code'], stage: 'mempool' });
    }

    const receipt = receiptForStage({
      transactionId: signed.transactionId,
      stage: 'ACCEPTED',
      source: 'MEMPOOL_ADMISSION',
    });
    this.receipts.set(signed.transactionId, receipt);
    const submitted = advanceReceipt(receipt, 'SUBMITTED', 'MEMPOOL_ADMISSION');
    this.receipts.set(signed.transactionId, submitted);
    return ok(submitted);
  }

  executeFromMempool(txId: string): Result<StateTransitionResult, LifecycleRejection> {
    const entry = this.mempool.get(txId);
    if (!entry) {
      return err({ code: 'MALFORMED', stage: 'executeFromMempool' });
    }
    const issuance = this.consumeIssuanceOnExecution(entry.envelope);
    if (issuance === 'DUPLICATE_ISSUANCE') {
      this.mempool.remove(txId);
      this.receipts.set(
        txId,
        receiptForStage({
          transactionId: txId,
          stage: 'REJECTED',
          source: 'EXECUTION',
          rejectionCode: 'DUPLICATE_ISSUANCE',
        }),
      );
      return err({ code: 'DUPLICATE_ISSUANCE', stage: 'executeFromMempool' });
    }
    const result = processTransaction(entry.bytes, this.state, this.context);
    if (!result.ok) {
      this.mempool.remove(txId);
      this.receipts.set(
        txId,
        receiptForStage({
          transactionId: txId,
          stage: 'REJECTED',
          source: 'EXECUTION',
          rejectionCode: result.error.code,
        }),
      );
      return result;
    }
    this.mempool.remove(txId);
    this.receipts.set(
      txId,
      receiptForStage({
        transactionId: txId,
        stage: 'EXECUTED',
        source: 'EXECUTION',
      }),
    );
    return result;
  }

  includeInBlock(txIds: readonly string[], height: number, blockId: string): readonly TransactionReceipt[] {
    const receipts: TransactionReceipt[] = [];
    for (const txId of txIds) {
      const current = this.receipts.get(txId);
      if (!current) {
        continue;
      }
      const included = advanceReceipt(current, 'INCLUDED', 'BLOCK_INCLUSION', { height, blockId });
      this.receipts.set(txId, included);
      receipts.push(included);
    }
    return Object.freeze(receipts);
  }

  finalize(txId: string, height: number, blockId: string): TransactionReceipt | null {
    const current = this.receipts.get(txId);
    if (!current || current.stage === 'REJECTED') {
      return null;
    }
    const finalized = advanceReceipt(current, 'FINALIZED', 'COMMIT_CERTIFICATE', { height, blockId });
    this.receipts.set(txId, finalized);
    return finalized;
  }

  receipt(txId: string): TransactionReceipt | undefined {
    return this.receipts.get(txId);
  }

  validateAdmissionOnly(bytes: Uint8Array): Result<EnvelopeV1, LifecycleRejection> {
    const decoded = decode(bytes);
    if (!decoded.ok) {
      return decoded;
    }
    const enveloped = validateEnvelope(decoded.value, this.context);
    if (!enveloped.ok) {
      return enveloped;
    }
    const stateless = validateStateless(enveloped.value);
    if (!stateless.ok) {
      return stateless;
    }
    const authenticated = validateAuthentication(stateless.value);
    if (!authenticated.ok) {
      return authenticated;
    }
    const replay = validateReplay(authenticated.value, this.state, this.context);
    if (!replay.ok) {
      return replay;
    }
    return ok(replay.value);
  }

  private rejectCrossAssetMutation(envelope: EnvelopeV1): LifecycleRejection | null {
    if (envelope.body.family !== 'NATIVE_ASSET') {
      return null;
    }
    const body = envelope.body;
    const asset = body.amount?.assetId;
    if (!asset) {
      return null;
    }
    const header = bodyHeaderOf(envelope.body);
    const actorAssetScope = header.purpose.includes('sunrey') && asset === 'MOONREY_COIN';
    const sunreyPurposeOnMoonrey =
      header.purpose.startsWith('sunrey.native-asset') && asset === 'MOONREY_COIN' && body.operation === 'TRANSFER';
    const moonreyPurposeOnSunrey =
      header.purpose.includes('moonrey') && asset === 'SUNREY_COIN';
    if (sunreyPurposeOnMoonrey || moonreyPurposeOnSunrey || actorAssetScope) {
      if (header.purpose === 'sunrey.native-asset.transfer' && asset === 'MOONREY_COIN') {
        return { code: 'CROSS_ASSET', stage: 'submit' };
      }
      if (header.purpose.includes('moonrey') && asset === 'SUNREY_COIN') {
        return { code: 'CROSS_ASSET', stage: 'submit' };
      }
    }
    return null;
  }

  private guardIssuanceReplay(envelope: EnvelopeV1): LifecycleRejection | null {
    if (envelope.body.family !== 'NATIVE_ASSET') {
      return null;
    }
    const body = envelope.body;
    if (body.operation !== 'ISSUE' && body.operation !== 'BURN') {
      return null;
    }
    const assetId = body.amount?.assetId;
    if (!assetId) {
      return { code: 'UNAUTHORIZED_ISSUANCE', stage: 'submit' };
    }
    const authRef = body.executionConditions.startsWith('auth:')
      ? body.executionConditions.slice(5)
      : body.header.policyRef;
    const extracted = extractIssuanceAuthorization(body.operation, authRef, assetId);
    if (!extracted) {
      return { code: 'UNAUTHORIZED_ISSUANCE', stage: 'submit' };
    }
    if (this.issuanceRegistry.isConsumed(extracted)) {
      return { code: 'DUPLICATE_ISSUANCE', stage: 'submit' };
    }
    return null;
  }

  consumeIssuanceOnExecution(envelope: EnvelopeV1): 'OK' | 'DUPLICATE_ISSUANCE' | 'SKIP' {
    if (envelope.body.family !== 'NATIVE_ASSET') {
      return 'SKIP';
    }
    const body = envelope.body;
    if (body.operation !== 'ISSUE' && body.operation !== 'BURN') {
      return 'SKIP';
    }
    const assetId = body.amount?.assetId;
    if (!assetId) {
      return 'SKIP';
    }
    const authRef = body.executionConditions.startsWith('auth:')
      ? body.executionConditions.slice(5)
      : body.header.policyRef;
    const extracted = extractIssuanceAuthorization(body.operation, authRef, assetId);
    if (!extracted) {
      return 'SKIP';
    }
    return this.issuanceRegistry.consume(extracted);
  }
}

export function executeBlock(
  lifecycle: TransactionLifecycle,
  txIds: readonly string[],
  height: number,
  blockId: string,
): readonly { readonly txId: string; readonly ok: boolean; readonly receipt: TransactionReceipt }[] {
  lifecycle.includeInBlock(txIds, height, blockId);
  const outcomes: { txId: string; ok: boolean; receipt: TransactionReceipt }[] = [];
  for (const txId of txIds) {
    const executed = lifecycle.executeFromMempool(txId);
    if (!executed.ok) {
      const receipt =
        lifecycle.receipt(txId) ??
        receiptForStage({
          transactionId: txId,
          stage: 'REJECTED',
          source: 'EXECUTION',
          rejectionCode: executed.error.code,
        });
      outcomes.push({ txId, ok: false, receipt });
      continue;
    }
    const finalized = lifecycle.finalize(txId, height, blockId);
    outcomes.push({
      txId,
      ok: true,
      receipt: finalized ?? lifecycle.receipt(txId)!,
    });
  }
  return Object.freeze(outcomes);
}
