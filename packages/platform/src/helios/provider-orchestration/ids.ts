import { createHash } from 'node:crypto';

export type ExternalAccountApplicationId = string & { readonly __brand: 'ExternalAccountApplicationId' };
export type FundingRelationshipId = string & { readonly __brand: 'FundingRelationshipId' };
export type FundingOperationId = string & { readonly __brand: 'FundingOperationId' };
export type CustodyWalletProvisionId = string & { readonly __brand: 'CustodyWalletProvisionId' };

export function asExternalAccountApplicationId(value: string): ExternalAccountApplicationId {
  return value as ExternalAccountApplicationId;
}

export function asFundingRelationshipId(value: string): FundingRelationshipId {
  return value as FundingRelationshipId;
}

export function asFundingOperationId(value: string): FundingOperationId {
  return value as FundingOperationId;
}

export function asCustodyWalletProvisionId(value: string): CustodyWalletProvisionId {
  return value as CustodyWalletProvisionId;
}

export function externalAccountApplicationIdFor(
  customerId: string,
  idempotencyKey: string,
): ExternalAccountApplicationId {
  const digest = createHash('sha256')
    .update(`${customerId}:${idempotencyKey}`)
    .digest('hex')
    .slice(0, 16);
  return asExternalAccountApplicationId(`eaa_${digest}`);
}

export function fundingOperationIdFor(customerId: string, idempotencyKey: string): FundingOperationId {
  const digest = createHash('sha256')
    .update(`fund:${customerId}:${idempotencyKey}`)
    .digest('hex')
    .slice(0, 16);
  return asFundingOperationId(`fop_${digest}`);
}

export function custodyWalletProvisionIdFor(
  customerId: string,
  idempotencyKey: string,
): CustodyWalletProvisionId {
  const digest = createHash('sha256')
    .update(`wallet:${customerId}:${idempotencyKey}`)
    .digest('hex')
    .slice(0, 16);
  return asCustodyWalletProvisionId(`cwp_${digest}`);
}

export function fundingRelationshipIdFor(
  customerId: string,
  sourceReference: string,
  destinationAccountId: string,
): FundingRelationshipId {
  const digest = createHash('sha256')
    .update(`${customerId}:${sourceReference}:${destinationAccountId}`)
    .digest('hex')
    .slice(0, 16);
  return asFundingRelationshipId(`frl_${digest}`);
}
