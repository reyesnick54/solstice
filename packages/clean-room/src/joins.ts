import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { KeyProvider } from '../../security/src/provider.ts';
import { joinKeyIdFor, type PseudonymousJoinKeyId } from './ids.ts';
import type { CleanRoomFailure } from './types.ts';

export type JoinToken = {
  readonly joinKeyId: PseudonymousJoinKeyId;
  readonly tokenHex: string;
  readonly requesterId: string;
  readonly purposeId: string;
  readonly createdAt: UtcInstant;
};

export function issueJoinToken(input: {
  readonly keys: KeyProvider;
  readonly requesterId: string;
  readonly purposeId: string;
  readonly subjectId: string;
  readonly now: UtcInstant;
}): Result<JoinToken, CleanRoomFailure> {
  const payload = `clean-room-join|${input.requesterId}|${input.purposeId}|${input.subjectId}`;
  const signed = input.keys.sign('CLEAN_ROOM_JOIN_TOKEN', payload);
  if (!signed.ok) {
    return err({ code: 'DEFAULT_DENY', message: signed.error.message });
  }
  return ok(
    Object.freeze({
      joinKeyId: joinKeyIdFor(signed.value.hex),
      tokenHex: signed.value.hex,
      requesterId: input.requesterId,
      purposeId: input.purposeId,
      createdAt: input.now,
    }),
  );
}
