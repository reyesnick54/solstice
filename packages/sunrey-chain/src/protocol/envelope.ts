import type { ActorDescriptor } from './actor.ts';
import type { NativeAssetOperation } from './assets.ts';
import type { EconomicObject } from './economic-object.ts';
import type { ProtocolQuantity } from './quantity.ts';
import type { RightObject } from './rights.ts';
import type { TransactionFamily } from './transaction-family.ts';

export type BodyHeader = {
  readonly schemaVersion: 1;
  readonly clientTxId: string;
  readonly actor: ActorDescriptor;
  readonly sequence: bigint;
  readonly idempotencyKey: string;
  readonly purpose: string;
  readonly jurisdiction: string;
  readonly expirationUnixSeconds: bigint;
  readonly legalEntityRef: string;
  readonly policyRef: string;
  readonly consentRef: string;
  readonly capabilityRef: string;
};

export type Authentication = {
  readonly schemaVersion: 1;
  readonly algorithmId: 1;
  readonly publicKey: Uint8Array;
  readonly signature: Uint8Array;
  readonly keyVersion: number;
};

export type NativeAssetBody = {
  readonly family: 'NATIVE_ASSET';
  readonly header: BodyHeader;
  readonly economicObject: EconomicObject | null;
  readonly rightsExercised: readonly RightObject[];
  readonly amount: ProtocolQuantity | null;
  readonly fee: ProtocolQuantity | null;
  readonly operation: NativeAssetOperation;
  readonly counterpartyActorId: string;
  readonly executionConditions: string;
  readonly evidenceRequirements: readonly string[];
};

export type IdentityBody = {
  readonly family: 'IDENTITY';
  readonly header: BodyHeader;
  readonly subject: ActorDescriptor;
  readonly credentialRef: string;
};

export type AttestationBody = {
  readonly family: 'ATTESTATION';
  readonly header: BodyHeader;
  readonly attestation: EconomicObject;
  readonly issuerRef: string;
};

export type RightsBody = {
  readonly family: 'RIGHTS';
  readonly header: BodyHeader;
  readonly right: RightObject;
  readonly grantOrRevoke: 'GRANT' | 'REVOKE';
};

export type ConsentReferenceBody = {
  readonly family: 'CONSENT_REFERENCE';
  readonly header: BodyHeader;
  readonly consentReceiptCommitment: string;
  readonly purposeId: string;
};

export type ProductiveCapacityBody = {
  readonly family: 'PRODUCTIVE_CAPACITY';
  readonly header: BodyHeader;
  readonly capacity: EconomicObject;
  readonly rightsExercised: readonly RightObject[];
  readonly quantity: ProtocolQuantity | null;
};

export type DeliveryBody = {
  readonly family: 'DELIVERY';
  readonly header: BodyHeader;
  readonly deliveryClaim: EconomicObject;
  readonly rightsExercised: readonly RightObject[];
};

export type EvidenceAnchorBody = {
  readonly family: 'EVIDENCE_ANCHOR';
  readonly header: BodyHeader;
  readonly anchor: EconomicObject;
  readonly vaultRecordHash: string;
};

export type ReservedBody = {
  readonly family: 'SYSTEM' | 'ORACLE' | 'EXCHANGE_SETTLEMENT' | 'GOVERNANCE' | 'VALIDATOR';
  readonly header: BodyHeader;
};

export type TransactionBodyV1 =
  | NativeAssetBody
  | IdentityBody
  | AttestationBody
  | RightsBody
  | ConsentReferenceBody
  | ProductiveCapacityBody
  | DeliveryBody
  | EvidenceAnchorBody
  | ReservedBody;

export type EnvelopeV1 = {
  readonly networkId: string;
  readonly chainId: string;
  readonly codecId: string;
  readonly schemaVersion: 1;
  readonly transactionType: TransactionFamily;
  readonly body: TransactionBodyV1;
  readonly authentication: Authentication;
};

export type BlockHeaderV1 = {
  readonly networkId: string;
  readonly chainId: string;
  readonly codecId: string;
  readonly schemaVersion: 1;
  readonly height: bigint;
  readonly previousBlockHash: Uint8Array;
  readonly appHash: Uint8Array;
  readonly transactionRoot: Uint8Array;
  readonly validatorSetHash: Uint8Array;
  readonly consensusParametersHash: Uint8Array;
  readonly timeUnixSeconds: bigint;
};

export function bodyHeaderOf(body: TransactionBodyV1): BodyHeader {
  return body.header;
}
