/**
 * MainnetAuthorizationRecord — human-only signing surface.
 *
 * AI, agents, and automation cannot sign. A rejected AI attempt is
 * a first-class correct outcome.
 */

import { encodeString, encodeU32, sha256Hex } from '../validators/canonical.ts';
import {
  AUTHORIZATION_ROLES,
  REQUIRED_HUMAN_ROLES,
  type ActorKind,
  type AuthorizationRole,
  type MainnetAuthorizationRecord,
} from './types.ts';

export const AUTHORIZATION_DOMAIN = 'SUNREY_MAINNET_AUTHORIZATION_V1' as const;

export type AuthorizationInput = {
  readonly actorKind: ActorKind;
  readonly actorId: string;
  readonly role: AuthorizationRole;
  readonly statement: string;
  readonly signedAtUtc: string;
  readonly signatureHex: string;
};

function looksLikeNonHuman(actorId: string, actorKind: ActorKind): boolean {
  if (actorKind !== 'HUMAN') {
    return true;
  }
  const lowered = actorId.toLowerCase();
  return (
    lowered.includes('ai-') ||
    lowered.startsWith('ai_') ||
    lowered.includes('agent.') ||
    lowered.includes('automation')
  );
}

export function recordHumanAuthorization(input: AuthorizationInput): MainnetAuthorizationRecord {
  if (!AUTHORIZATION_ROLES.includes(input.role)) {
    return Object.freeze({
      recordId: 'rejected',
      actorKind: input.actorKind,
      actorId: input.actorId,
      role: input.role,
      statement: input.statement,
      signedAtUtc: input.signedAtUtc,
      signatureHex: input.signatureHex,
      accepted: false,
      rejectionReason: 'unknown authorization role',
    });
  }
  if (looksLikeNonHuman(input.actorId, input.actorKind)) {
    return Object.freeze({
      recordId: 'rejected-ai',
      actorKind: input.actorKind,
      actorId: input.actorId,
      role: input.role,
      statement: input.statement,
      signedAtUtc: input.signedAtUtc,
      signatureHex: input.signatureHex,
      accepted: false,
      rejectionReason: 'AI cannot sign MainnetAuthorizationRecord',
    });
  }
  if (input.signatureHex.length < 16) {
    return Object.freeze({
      recordId: 'rejected-signature',
      actorKind: input.actorKind,
      actorId: input.actorId,
      role: input.role,
      statement: input.statement,
      signedAtUtc: input.signedAtUtc,
      signatureHex: input.signatureHex,
      accepted: false,
      rejectionReason: 'human authorization requires a signature',
    });
  }
  const recordId = sha256Hex(
    Buffer.concat([
      encodeString(AUTHORIZATION_DOMAIN),
      encodeString(input.actorId),
      encodeString(input.role),
      encodeString(input.signedAtUtc),
      encodeString(input.signatureHex),
    ]),
  );
  return Object.freeze({
    recordId,
    actorKind: 'HUMAN',
    actorId: input.actorId,
    role: input.role,
    statement: input.statement,
    signedAtUtc: input.signedAtUtc,
    signatureHex: input.signatureHex,
    accepted: true,
    rejectionReason: null,
  });
}

export function requiredHumanRolesPresent(
  records: readonly MainnetAuthorizationRecord[],
): boolean {
  const accepted = new Set(
    records.filter((row) => row.accepted && row.actorKind === 'HUMAN').map((row) => row.role),
  );
  return REQUIRED_HUMAN_ROLES.every((role) => accepted.has(role));
}

export function encodeAuthorizationSet(records: readonly MainnetAuthorizationRecord[]): Buffer {
  const ordered = [...records].sort((a, b) => a.recordId.localeCompare(b.recordId));
  const parts = [encodeString(AUTHORIZATION_DOMAIN), encodeU32(ordered.length)];
  for (const row of ordered) {
    parts.push(
      encodeString(row.recordId),
      encodeString(row.actorKind),
      encodeString(row.actorId),
      encodeString(row.role),
      encodeString(row.accepted ? '1' : '0'),
    );
  }
  return Buffer.concat(parts);
}
