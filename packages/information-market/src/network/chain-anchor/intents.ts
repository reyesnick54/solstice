import type { CreateIntentInput } from '../../../../sunrey-chain/src/service.ts';
import type { ChainRecordSchema } from '../../../../sunrey-chain/src/types.ts';
import type { HinAnchorKind, HinAnchorPrepareInput } from './types.ts';

const RECORD_TYPE: Record<HinAnchorKind, CreateIntentInput['recordType']> = {
  CONSENT_RECEIPT: 'CONSENT_RECEIPT',
  CONSENT_REVOCATION: 'CONSENT_REVOCATION',
  USAGE_RECEIPT: 'COMPUTATION_RECEIPT',
  COMPUTATION_RECEIPT: 'COMPUTATION_RECEIPT',
  PROOF_OF_CONTRIBUTION: 'PROOF_OF_CONTRIBUTION',
  DIGITAL_ASSET_SETTLEMENT: 'DIGITAL_ASSET_SETTLEMENT',
};

export function recordTypeForAnchorKind(kind: HinAnchorKind): CreateIntentInput['recordType'] {
  return RECORD_TYPE[kind];
}

export function privacySafeIntentInput(input: HinAnchorPrepareInput): CreateIntentInput {
  const recordType = recordTypeForAnchorKind(input.kind);
  const fields = { ...input.schemaFields };
  if (input.kind === 'PROOF_OF_CONTRIBUTION') {
    fields.doesNotMint = true;
  }
  if (input.kind === 'DIGITAL_ASSET_SETTLEMENT') {
    fields.authoritativeLedger = 'canonical-internal-ledger';
    fields.chainBalanceAuthoritative = false;
  }
  const schema: ChainRecordSchema = {
    recordType,
    dataClass: 'ON_CHAIN_SAFE',
    fields,
  };
  const subject = input.subjectRawId
    ? {
        kind: 'PSEUDONYMOUS_SUBJECT_REFERENCE' as const,
        rawSubjectId: input.subjectRawId,
        recipientContext: input.requesterId ?? 'hin-network',
        purpose: input.purpose,
        jurisdictionCell: input.jurisdictionCell,
        keyVersion: 1,
      }
    : undefined;
  return {
    recordType,
    sourceSubsystem: 'information-market',
    sourceRecordReference: input.sourceRecordId,
    purpose: input.purpose,
    schema,
    policyVersion: 'hin-anchor-v1',
    jurisdictionCell: input.jurisdictionCell,
    correlationId: input.correlationId,
    ...(subject ? { subject } : {}),
  };
}
