/**
 * Ceremony participants, AI restrictions, and multi-person control.
 *
 * AI may prepare checklists, verify hashes, summarize evidence, and
 * compare candidate inputs. AI cannot serve as a required human signer,
 * generate human approval, activate genesis, or authorize launch.
 */

import { encodeString, sha256Hex } from '../validators/canonical.ts';
import {
  PRODUCTION_GENESIS_AUTHORITY_ID,
  PRODUCTION_PROTOCOL_AUTHORITY_ID,
  PRODUCTION_RELEASE_AUTHORITY_ID,
  PRODUCTION_SECURITY_AUTHORITY_ID,
} from './identity.ts';
import type {
  ProductionAuthorityDossier,
  ProductionCeremonyActorKind,
  ProductionCeremonyParticipant,
  ProductionCeremonyRole,
  ProductionKeyPurpose,
} from './types.ts';
import { REQUIRED_PRODUCTION_HUMAN_ROLES } from './types.ts';

const AI_FORBIDDEN = [
  'approve',
  'sign_as_human',
  'activate_genesis',
  'authorize_production_launch',
] as const;

export function participantIdentityHash(participant: Omit<ProductionCeremonyParticipant, 'publicIdentityHash'>): string {
  return sha256Hex(
    Buffer.concat([
      encodeString('sunrey.ceremony.participant.v1'),
      encodeString(participant.participantId),
      encodeString(participant.role),
      encodeString(participant.actorKind),
    ]),
  );
}

export function registerParticipant(input: {
  readonly participantId: string;
  readonly displayName: string;
  readonly role: ProductionCeremonyRole;
  readonly actorKind: ProductionCeremonyActorKind;
}): ProductionCeremonyParticipant {
  if (
    (REQUIRED_PRODUCTION_HUMAN_ROLES as readonly string[]).includes(input.role) &&
    input.actorKind !== 'HUMAN'
  ) {
    throw new TypeError(`AI or automation cannot occupy required human role ${input.role}`);
  }
  const base = {
    participantId: input.participantId,
    displayName: input.displayName,
    role: input.role,
    actorKind: input.actorKind,
  };
  return Object.freeze({ ...base, publicIdentityHash: participantIdentityHash(base) });
}

export function assertAiCannot(
  actorKind: ProductionCeremonyActorKind,
  action: (typeof AI_FORBIDDEN)[number],
): void {
  if (actorKind === 'AI' || actorKind === 'AUTOMATION' || actorKind === 'SERVICE') {
    throw new TypeError(`AI human approval rejected: ${action.replaceAll('_', ' ')}`);
  }
}

export function rejectAiApproval(participant: { readonly actorKind: ProductionCeremonyActorKind; readonly role: ProductionCeremonyRole }): void {
  assertHumanApproval(participant.actorKind, participant.role);
}

export function assertHumanApproval(actorKind: ProductionCeremonyActorKind, role: ProductionCeremonyRole): void {
  assertAiCannot(actorKind, 'approve');
  if (actorKind !== 'HUMAN') {
    throw new TypeError(`${role} approval requires a human participant`);
  }
  if (!(REQUIRED_PRODUCTION_HUMAN_ROLES as readonly string[]).includes(role) && role === 'CEREMONY_OBSERVER') {
    throw new TypeError('observer cannot provide required human authorization');
  }
}

export function assertMultiPersonControl(approverRoles: readonly ProductionCeremonyRole[]): void {
  const unique = new Set(approverRoles.filter((role) => (REQUIRED_PRODUCTION_HUMAN_ROLES as readonly string[]).includes(role)));
  if (unique.size < REQUIRED_PRODUCTION_HUMAN_ROLES.length) {
    throw new TypeError('genesis authorization requires the configured multi-person human authority set');
  }
}

export function rejectGenericInfrastructureCredential(participantId: string): void {
  if (/^(ci|infra|automation|service|root|admin)-/i.test(participantId)) {
    throw new TypeError('no single generic infrastructure credential can authorize genesis');
  }
}

export function defaultDressRehearsalParticipants(): readonly ProductionCeremonyParticipant[] {
  const humans: ReadonlyArray<{
    readonly participantId: string;
    readonly displayName: string;
    readonly role: ProductionCeremonyRole;
  }> = [
    { participantId: 'human-genesis-1', displayName: 'genesis authority', role: 'GENESIS_AUTHORITY' },
    { participantId: 'human-protocol-1', displayName: 'protocol authority', role: 'PROTOCOL_AUTHORITY' },
    { participantId: 'human-security-1', displayName: 'security authority', role: 'SECURITY_AUTHORITY' },
    { participantId: 'human-operations-1', displayName: 'operations authority', role: 'OPERATIONS_AUTHORITY' },
    { participantId: 'human-release-1', displayName: 'release authority', role: 'RELEASE_AUTHORITY' },
    { participantId: 'human-observer-1', displayName: 'ceremony observer', role: 'CEREMONY_OBSERVER' },
  ];
  const operators = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((label) =>
    registerParticipant({
      participantId: `human-operator-${label.toLowerCase()}`,
      displayName: `validator operator ${label}`,
      role: 'VALIDATOR_OPERATOR',
      actorKind: 'HUMAN',
    }),
  );
  const ai = registerParticipant({
    participantId: 'ai-assistant-1',
    displayName: 'ceremony assistant',
    role: 'CEREMONY_OBSERVER',
    actorKind: 'AI',
  });
  return Object.freeze([
    ...humans.map((row) => registerParticipant({ ...row, actorKind: 'HUMAN' })),
    ...operators,
    ai,
  ]);
}

export function canonicalAuthorityDossiers(): readonly ProductionAuthorityDossier[] {
  const rows: ReadonlyArray<{
    readonly authorityId: string;
    readonly purpose: ProductionKeyPurpose;
    readonly threshold: number;
  }> = [
    { authorityId: PRODUCTION_GENESIS_AUTHORITY_ID, purpose: 'GENESIS_AUTHORITY', threshold: 2 },
    { authorityId: PRODUCTION_PROTOCOL_AUTHORITY_ID, purpose: 'PROTOCOL_GOVERNANCE', threshold: 2 },
    { authorityId: PRODUCTION_SECURITY_AUTHORITY_ID, purpose: 'SECURITY_GOVERNANCE', threshold: 2 },
    { authorityId: PRODUCTION_RELEASE_AUTHORITY_ID, purpose: 'RELEASE_AUTHORITY', threshold: 2 },
  ];
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        authorityId: row.authorityId,
        purpose: row.purpose,
        publicDescriptor: `descriptor:${row.authorityId}`,
        threshold: row.threshold,
        requiredHuman: true,
        occupiedByAi: false,
      }),
    ),
  );
}

export function aiChecklist(items: readonly string[]): readonly string[] {
  return Object.freeze([
    'AI checklist only. Not a human approval.',
    ...items,
  ]);
}

export function aiMaySummarizeEvidence(): true {
  return true;
}
