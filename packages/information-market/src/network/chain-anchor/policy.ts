import type { ChainRecordType } from '../../../../sunrey-chain/src/index.ts';
import type { HinAnchorKind } from './types.ts';

export const HIN_CHAIN_ANCHOR_OWNER = Object.freeze({
  HIN_RIGHTS_OWNER: 'packages/information-market',
  CHAIN_OWNER: 'packages/sunrey-chain',
  capability: 'sunrey-hin-chain-anchoring',
  chunk: 'CHUNK-139',
  lifecycleComplete: false,
});

export const HIN_CHAIN_ANCHOR_INVARIANTS = Object.freeze({
  CHAIN_ANCHOR_IS_RIGHTS_EVIDENCE: true,
  CHAIN_ANCHOR_TRANSFERS_OWNERSHIP: false,
  ANCHOR_MINTS_SUNREY: false,
  ANCHOR_MINTS_MOONREY: false,
  RAW_PERSONAL_DATA_ON_CHAIN: false,
  PRODUCTION_ACTIVE: false,
  createsMonetaryAuthority: false,
  inventsSettlementRef: false,
});

export const HIN_ANCHOR_COMMITMENT_DOMAINS = Object.freeze({
  CONSENT_GRANT: 'hin.anchor.consent.v1',
  CONSENT_REVOCATION: 'hin.anchor.revocation.v1',
  INFORMATION_RIGHT_STATE: 'hin.anchor.right.v1',
  PURPOSE_GRANT: 'hin.anchor.purpose.v1',
  USAGE_RECEIPT: 'hin.anchor.usage.v1',
  CLEAN_ROOM_COMPUTATION: 'hin.anchor.computation.v1',
  PROVENANCE: 'hin.anchor.provenance.v1',
  HUMAN_CONTRIBUTION_PROOF: 'hin.anchor.contribution.v1',
  COMPENSATION_SETTLEMENT_REFERENCE: 'hin.anchor.settlement.v1',
  IDEMPOTENCY: 'hin.anchor.key.v1',
  SUBJECT: 'hin.anchor.subject.v1',
} as const);

export const HIN_ANCHOR_KIND_TO_CHAIN_RECORD = Object.freeze({
  CONSENT_GRANT: 'CONSENT_RECEIPT',
  CONSENT_REVOCATION: 'CONSENT_REVOCATION',
  INFORMATION_RIGHT_STATE: 'EVIDENCE_ANCHOR',
  PURPOSE_GRANT: 'EVIDENCE_ANCHOR',
  USAGE_RECEIPT: 'COMPUTATION_RECEIPT',
  CLEAN_ROOM_COMPUTATION: 'COMPUTATION_RECEIPT',
  PROVENANCE: 'PROVENANCE',
  HUMAN_CONTRIBUTION_PROOF: 'PROOF_OF_CONTRIBUTION',
  COMPENSATION_SETTLEMENT_REFERENCE: 'DIGITAL_ASSET_SETTLEMENT',
} as const satisfies Record<HinAnchorKind, ChainRecordType>);

export function chainRecordTypeFor(
  kind: HinAnchorKind,
  options?: { readonly hasComputation?: boolean },
): ChainRecordType {
  if (kind === 'USAGE_RECEIPT' && options?.hasComputation === false) {
    return 'EVIDENCE_ANCHOR';
  }
  return HIN_ANCHOR_KIND_TO_CHAIN_RECORD[kind];
}

export const HIN_ANCHOR_FORBIDDEN_KEYS = Object.freeze([
  'legalName',
  'legal_name',
  'fullName',
  'email',
  'phone',
  'address',
  'ssn',
  'nationalId',
  'kyc',
  'kycPayload',
  'rawKyc',
  'rawPdv',
  'rawPdvData',
  'rawPayload',
  'healthRecord',
  'healthData',
  'geneticData',
  'geneticInformation',
  'privateCommunications',
  'deviceHistory',
  'behavioralHistory',
  'bankAccount',
  'iban',
  'routingNumber',
  'pan',
  'cvv',
  'privateKey',
  'private_key',
  'apiKey',
  'apiCredential',
  'password',
  'seedPhrase',
  'cleanRoomRows',
  'sourceRows',
  'inputRows',
  'compensationTerms',
]);
