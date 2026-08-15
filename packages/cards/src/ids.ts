import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type CardId = Brand<string, 'CardId'>;
export type CardProgramId = Brand<string, 'CardProgramId'>;
export type ProcessorCardReference = Brand<string, 'ProcessorCardReference'>;
export type NetworkTokenReference = Brand<string, 'NetworkTokenReference'>;
export type CardAuthorizationId = Brand<string, 'CardAuthorizationId'>;
export type CardClearingId = Brand<string, 'CardClearingId'>;
export type CardSettlementId = Brand<string, 'CardSettlementId'>;
export type DisputeId = Brand<string, 'DisputeId'>;
export type CardRefundId = Brand<string, 'CardRefundId'>;
export type CardFeeId = Brand<string, 'CardFeeId'>;
export type MerchantReference = Brand<string, 'MerchantReference'>;

function brandId<Name extends string>(value: string, name: Name): Brand<string, Name> {
  if (value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return brandAs<string, Name>(value);
}

export function asCardId(value: string): CardId {
  return brandId(value, 'CardId');
}

export function asCardProgramId(value: string): CardProgramId {
  return brandId(value, 'CardProgramId');
}

export function asProcessorCardReference(value: string): ProcessorCardReference {
  if (!value.startsWith('sim_tok_') && !value.startsWith('sim_proc_')) {
    throw new TypeError('ProcessorCardReference must be a synthetic sim_tok_ or sim_proc_ value');
  }
  return brandId(value, 'ProcessorCardReference');
}

export function asNetworkTokenReference(value: string): NetworkTokenReference {
  if (!value.startsWith('sim_ntok_')) {
    throw new TypeError('NetworkTokenReference must be a synthetic sim_ntok_ value');
  }
  return brandId(value, 'NetworkTokenReference');
}

export function asCardAuthorizationId(value: string): CardAuthorizationId {
  return brandId(value, 'CardAuthorizationId');
}

export function asCardClearingId(value: string): CardClearingId {
  return brandId(value, 'CardClearingId');
}

export function asCardSettlementId(value: string): CardSettlementId {
  return brandId(value, 'CardSettlementId');
}

export function asDisputeId(value: string): DisputeId {
  return brandId(value, 'DisputeId');
}

export function asCardRefundId(value: string): CardRefundId {
  return brandId(value, 'CardRefundId');
}

export function asCardFeeId(value: string): CardFeeId {
  return brandId(value, 'CardFeeId');
}

export function asMerchantReference(value: string): MerchantReference {
  return brandId(value, 'MerchantReference');
}
