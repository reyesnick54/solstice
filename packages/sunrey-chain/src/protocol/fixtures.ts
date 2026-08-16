import { PROTOCOL_CHAIN_ID, PROTOCOL_CODEC_ID, PROTOCOL_NETWORK_ID, PROTOCOL_SCHEMA_VERSION } from './constants.ts';
import type { ActorDescriptor } from './actor.ts';
import type { EconomicObject } from './economic-object.ts';
import type { BodyHeader, EnvelopeV1, NativeAssetBody } from './envelope.ts';
import type { ProtocolQuantity } from './quantity.ts';
import type { RightObject } from './rights.ts';
import { signEnvelope } from './authentication.ts';

export const VECTOR_ED25519_SEED = Buffer.from(
  '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
  'hex',
);

export function fixtureActor(overrides: Partial<ActorDescriptor> = {}): ActorDescriptor {
  return Object.freeze({
    schemaVersion: 1,
    actorId: 'actor.human.alice',
    actorType: 'HUMAN',
    ownerControllerId: 'actor.human.alice',
    credentialRefs: Object.freeze(['cred.identity.alice']),
    capabilityRefs: Object.freeze([] as string[]),
    modelFirmwareRef: '',
    jurisdiction: 'GB:SIM',
    revocationState: 'ACTIVE',
    identitySystemRef: 'solstice.identity',
    ...overrides,
  });
}

export function fixtureHeader(overrides: Partial<BodyHeader> = {}): BodyHeader {
  return Object.freeze({
    schemaVersion: 1,
    clientTxId: 'client.tx.transfer.1',
    actor: fixtureActor(),
    sequence: 1n,
    idempotencyKey: 'idem.transfer.1',
    purpose: 'sunrey.native-asset.transfer',
    jurisdiction: 'GB:SIM',
    expirationUnixSeconds: 1_800_000_000n,
    legalEntityRef: 'le.sim.1',
    policyRef: 'policy.sim.v1',
    consentRef: 'consent.sim.1',
    capabilityRef: '',
    ...overrides,
  });
}

export function fixtureQuantity(scaledUnits: bigint, assetId: ProtocolQuantity['assetId'] = 'SUNREY_COIN'): ProtocolQuantity {
  return Object.freeze({
    schemaVersion: PROTOCOL_SCHEMA_VERSION,
    assetId,
    scaledUnits,
  });
}

export function fixtureRight(overrides: Partial<RightObject> = {}): RightObject {
  return Object.freeze({
    schemaVersion: 1,
    rightId: 'right.transfer.alice',
    rightType: 'TRANSFER',
    subjectId: 'actor.human.alice',
    objectId: 'obj.native.sunrey_coin',
    holderId: 'actor.human.alice',
    issuerId: 'actor.human.alice',
    scope: 'native-asset-transfer',
    purpose: 'sunrey.native-asset.transfer',
    permittedOperations: Object.freeze(['TRANSFER']),
    jurisdiction: 'GB:SIM',
    startUnixSeconds: 1_700_000_000n,
    expirationUnixSeconds: 1_900_000_000n,
    revocationState: 'ACTIVE',
    transferable: false,
    compensationRef: '',
    provenanceRef: 'prov.sim.1',
    ...overrides,
  });
}

export function fixtureObject(overrides: Partial<EconomicObject> = {}): EconomicObject {
  return Object.freeze({
    schemaVersion: 1,
    objectId: 'obj.native.sunrey_coin',
    objectType: 'FUNGIBLE_NATIVE_ASSET',
    commitmentHex: 'aa'.repeat(32),
    schemaRef: 'sunrey.object.fungible-native-asset.v1',
    issuerRef: 'issuer.protocol',
    subjectRef: 'actor.human.alice',
    revocationState: 'ACTIVE',
    jurisdiction: 'GB:SIM',
    quantity: fixtureQuantity(100n),
    attestationRef: '',
    evidenceRef: '',
    ...overrides,
  });
}

export function fixtureTransferBody(overrides: Partial<NativeAssetBody> = {}): NativeAssetBody {
  return Object.freeze({
    family: 'NATIVE_ASSET',
    header: fixtureHeader(),
    economicObject: fixtureObject(),
    rightsExercised: Object.freeze([fixtureRight()]),
    amount: fixtureQuantity(25n),
    fee: fixtureQuantity(1n),
    operation: 'TRANSFER',
    counterpartyActorId: 'actor.human.bob',
    executionConditions: '',
    evidenceRequirements: Object.freeze(['evidence.settlement-anchor']),
    ...overrides,
  });
}

export function unsignedTransferEnvelope(overrides: Partial<EnvelopeV1> = {}): EnvelopeV1 {
  return Object.freeze({
    networkId: PROTOCOL_NETWORK_ID,
    chainId: PROTOCOL_CHAIN_ID,
    codecId: PROTOCOL_CODEC_ID,
    schemaVersion: PROTOCOL_SCHEMA_VERSION,
    transactionType: 'NATIVE_ASSET',
    body: fixtureTransferBody(),
    authentication: Object.freeze({
      schemaVersion: 1 as const,
      algorithmId: 1 as const,
      publicKey: new Uint8Array(32),
      signature: new Uint8Array(0),
      keyVersion: 1,
    }),
    ...overrides,
  });
}

export function signedTransferEnvelope(overrides: Partial<EnvelopeV1> = {}): EnvelopeV1 {
  return signEnvelope(unsignedTransferEnvelope(overrides), VECTOR_ED25519_SEED);
}
