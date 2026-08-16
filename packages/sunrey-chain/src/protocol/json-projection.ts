import { NATIVE_ASSET_TICKER_STATUS } from './assets.ts';
import type { EnvelopeV1 } from './envelope.ts';
import { rejectJsonConsensusHash } from './hash.ts';

export type EnvelopeDebugJson = {
  readonly projection: 'debug-only';
  readonly notForConsensusHash: true;
  readonly tickerStatus: typeof NATIVE_ASSET_TICKER_STATUS;
  readonly networkId: string;
  readonly chainId: string;
  readonly codecId: string;
  readonly schemaVersion: 1;
  readonly transactionType: string;
  readonly family: string;
  readonly actorId: string;
  readonly actorType: string;
  readonly sequence: string;
  readonly purpose: string;
};

export function toDebugJson(envelope: EnvelopeV1): EnvelopeDebugJson {
  return Object.freeze({
    projection: 'debug-only',
    notForConsensusHash: true,
    tickerStatus: NATIVE_ASSET_TICKER_STATUS,
    networkId: envelope.networkId,
    chainId: envelope.chainId,
    codecId: envelope.codecId,
    schemaVersion: envelope.schemaVersion,
    transactionType: envelope.transactionType,
    family: envelope.body.family,
    actorId: envelope.body.header.actor.actorId,
    actorType: envelope.body.header.actor.actorType,
    sequence: envelope.body.header.sequence.toString(),
    purpose: envelope.body.header.purpose,
  });
}

export function debugJsonMustNotBeHashed(value: unknown): never {
  return rejectJsonConsensusHash(value);
}
