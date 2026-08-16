import type {
  ChainAdapterId,
  ChainBlockReference,
  ChainOperationId,
  ChainReceiptId,
  ChainTransactionId,
} from './ids.ts';
import type { ChainHealthStatus, ChainOperationState } from './taxonomy.ts';
import type { ChainFailure, ChainHealth, ChainReceipt, ChainWriteIntent } from './types.ts';

export type AdapterSubmitResult =
  | {
      readonly outcome: 'ACCEPTED';
      readonly transactionId: ChainTransactionId;
      readonly receiptId: ChainReceiptId;
      readonly blockReference: ChainBlockReference;
      readonly state: Extract<ChainOperationState, 'ACCEPTED' | 'PENDING_FINALITY'>;
    }
  | {
      readonly outcome: 'DUPLICATE';
      readonly transactionId: ChainTransactionId;
      readonly receiptId: ChainReceiptId;
      readonly blockReference: ChainBlockReference;
      readonly state: ChainOperationState;
    }
  | {
      readonly outcome: 'UNKNOWN';
      readonly transactionId: ChainTransactionId | null;
      readonly reason: string;
    }
  | { readonly outcome: 'REJECTED'; readonly reason: string }
  | { readonly outcome: 'UNAVAILABLE'; readonly reason: string };

export type SunReyChainAdapter = {
  readonly adapterId: ChainAdapterId;
  submitCommitment(intent: ChainWriteIntent): AdapterSubmitResult;
  submitAttestation(intent: ChainWriteIntent): AdapterSubmitResult;
  submitPermissionRecord(intent: ChainWriteIntent): AdapterSubmitResult;
  submitRevocation(intent: ChainWriteIntent): AdapterSubmitResult;
  submitProvenanceRecord(intent: ChainWriteIntent): AdapterSubmitResult;
  submitPolicyRecord(intent: ChainWriteIntent): AdapterSubmitResult;
  submitSettlementAnchor(intent: ChainWriteIntent): AdapterSubmitResult;
  getOperation(operationId: ChainOperationId): ChainOperationState | undefined;
  getReceipt(receiptId: ChainReceiptId): ChainReceipt | undefined;
  getFinality(operationId: ChainOperationId): {
    readonly state: ChainOperationState;
    readonly confirmations: number;
    readonly blockReference: ChainBlockReference | null;
  };
  getHealth(): ChainHealth;
};

export function adapterMethodFor(
  recordType: ChainWriteIntent['recordType'],
): keyof Pick<
  SunReyChainAdapter,
  | 'submitCommitment'
  | 'submitAttestation'
  | 'submitPermissionRecord'
  | 'submitRevocation'
  | 'submitProvenanceRecord'
  | 'submitPolicyRecord'
  | 'submitSettlementAnchor'
> {
  switch (recordType) {
    case 'ATTESTATION':
      return 'submitAttestation';
    case 'CONSENT_RECEIPT':
    case 'IDENTITY_REFERENCE':
    case 'EVIDENCE_ANCHOR':
      return 'submitPermissionRecord';
    case 'CONSENT_REVOCATION':
      return 'submitRevocation';
    case 'PROVENANCE':
    case 'PROOF_OF_CONTRIBUTION':
      return 'submitProvenanceRecord';
    case 'POLICY_DECISION':
    case 'COMPUTATION_RECEIPT':
      return 'submitPolicyRecord';
    case 'DIGITAL_ASSET_SETTLEMENT':
      return 'submitSettlementAnchor';
    default:
      return 'submitCommitment';
  }
}

export function unavailableFailure(reason: string): ChainFailure {
  return { code: 'CHAIN_UNAVAILABLE', message: reason };
}
