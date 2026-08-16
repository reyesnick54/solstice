export const PROTOCOL_REJECTION_CODES = [
  'INVALID_VERSION',
  'WRONG_NETWORK',
  'WRONG_CHAIN',
  'UNKNOWN_CODEC',
  'MALFORMED',
  'OVERSIZED',
  'INVALID_SIGNATURE',
  'UNKNOWN_ACTOR',
  'INVALID_SEQUENCE',
  'REPLAY',
  'EXPIRED',
  'UNKNOWN_TRANSACTION_TYPE',
  'TRANSACTION_NOT_ACTIVATED',
  'INVALID_OBJECT_TYPE',
  'RIGHT_NOT_HELD',
  'PURPOSE_NOT_AUTHORIZED',
  'POLICY_REFERENCE_INVALID',
  'CONSENT_REFERENCE_INVALID',
  'CAPABILITY_INVALID',
  'ORACLE_REFERENCE_INVALID',
  'INSUFFICIENT_ASSET',
  'INVALID_FEE',
  'INVALID_QUANTITY',
] as const;

export type ProtocolRejectionCode = (typeof PROTOCOL_REJECTION_CODES)[number];

export type ProtocolRejection = {
  readonly code: ProtocolRejectionCode;
  readonly stage: ProtocolValidationStage;
};

export const PROTOCOL_VALIDATION_STAGES = [
  'decode',
  'validateEnvelope',
  'validateStateless',
  'validateAuthentication',
  'validateReplay',
  'validateStateful',
  'applyStateTransition',
] as const;
export type ProtocolValidationStage = (typeof PROTOCOL_VALIDATION_STAGES)[number];

export function protocolRejection(
  code: ProtocolRejectionCode,
  stage: ProtocolValidationStage,
): ProtocolRejection {
  return Object.freeze({ code, stage });
}
