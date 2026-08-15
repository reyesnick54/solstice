import { err, ok, type Result } from '../../domain/src/result.ts';
import { newContributionComputationId } from './ids.ts';
import type {
  CleanRoomComputationReceipt,
  CleanRoomFailure,
  ContributionComputationReference,
} from './types.ts';

export function recordContribution(input: {
  readonly subjectId: string;
  readonly receipt: CleanRoomComputationReceipt;
  readonly assetRefs: readonly string[];
  readonly freshness: string;
  readonly schemaCompleteness: 'COMPLETE' | 'PARTIAL';
  readonly duplicate: boolean;
  readonly alreadyRecorded: boolean;
}): Result<ContributionComputationReference, CleanRoomFailure> {
  if (input.alreadyRecorded) {
    return err({ code: 'DUPLICATE_CONTRIBUTION', message: 'contribution computation metadata already recorded for this subject and receipt' });
  }
  return ok(
    Object.freeze({
      contributionId: newContributionComputationId(),
      subjectId: input.subjectId,
      receiptId: input.receipt.receiptId,
      purposeId: input.receipt.purposeId,
      participatingAssetRefs: Object.freeze([...input.assetRefs]),
      provenanceScoreInputs: {
        sourceVerification: 'SIMULATED_CONNECTOR' as const,
        provenanceStrength: 'CONNECTOR' as const,
        freshness: input.freshness,
        schemaCompleteness: input.schemaCompleteness,
        duplicateState: input.duplicate ? ('DUPLICATE' as const) : ('UNIQUE' as const),
      },
      participationState: 'INCLUDED',
      coinIssued: false,
      marketPriceAssigned: false,
      humanMonetaryValueAssigned: false,
      marketplaceTrade: false,
      settledEarnings: false,
    }),
  );
}

export function toPegSafeReference(receipt: CleanRoomComputationReceipt): {
  readonly label: string;
  readonly computationReceiptId: string;
  readonly purposeVersion: string;
  readonly derivationVersion: string;
  readonly rawPayloadIncluded: false;
} {
  return {
    label: 'clean_room.computation',
    computationReceiptId: receipt.receiptId,
    purposeVersion: receipt.purposeVersion,
    derivationVersion: receipt.computationVersion,
    rawPayloadIncluded: false,
  };
}

export function toPeveContributionInput(ref: ContributionComputationReference): {
  readonly contributionId: string;
  readonly receiptId: string;
  readonly settledEarnings: false;
  readonly coinIssued: false;
} {
  return {
    contributionId: ref.contributionId,
    receiptId: ref.receiptId,
    settledEarnings: false,
    coinIssued: false,
  };
}
