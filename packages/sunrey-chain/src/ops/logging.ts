import type { ConsensusMessageType } from '../validators/types.ts';
import type { StructuredLogRecord } from './types.ts';

const FORBIDDEN = /seedHex|pkcs8|BEGIN [A-Z ]*PRIVATE|privateKeyHex|"privateKey"\s*:/i;

export function structuredLog(input: {
  readonly level: StructuredLogRecord['level'];
  readonly event: string;
  readonly height?: bigint;
  readonly round?: bigint;
  readonly step?: ConsensusMessageType;
  readonly peerState?: string;
  readonly consensusEvent?: string;
  readonly signerError?: string;
  readonly upgradeState?: string;
  readonly nowUtc: string;
}): StructuredLogRecord {
  const record: StructuredLogRecord = {
    ts: input.nowUtc,
    level: input.level,
    event: input.event,
    ...(input.height !== undefined ? { height: input.height.toString() } : {}),
    ...(input.round !== undefined ? { round: input.round.toString() } : {}),
    ...(input.step ? { step: input.step } : {}),
    ...(input.peerState ? { peerState: input.peerState } : {}),
    ...(input.consensusEvent ? { consensusEvent: input.consensusEvent } : {}),
    ...(input.signerError ? { signerError: input.signerError } : {}),
    ...(input.upgradeState ? { upgradeState: input.upgradeState } : {}),
  };
  const serialized = JSON.stringify(record);
  if (FORBIDDEN.test(serialized)) {
    throw new Error('validator logs must never include private key material');
  }
  return record;
}

export function assertNoPrivateKeyMaterial(value: unknown): void {
  const text = JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
  if (FORBIDDEN.test(text)) {
    throw new Error('operator API refused to emit private key material');
  }
}
