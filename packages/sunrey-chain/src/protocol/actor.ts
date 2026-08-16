export const ACTOR_TYPES = [
  'HUMAN',
  'PSEUDONYMOUS_HUMAN',
  'ENTERPRISE',
  'LEGAL_ENTITY',
  'AI_AGENT',
  'ROBOT',
  'DEVICE',
  'PRODUCTIVE_ASSET',
  'VALIDATOR',
  'ORACLE',
] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const ACTOR_TYPE_IDS: { readonly [K in ActorType]: number } = {
  HUMAN: 1,
  PSEUDONYMOUS_HUMAN: 2,
  ENTERPRISE: 3,
  LEGAL_ENTITY: 4,
  AI_AGENT: 5,
  ROBOT: 6,
  DEVICE: 7,
  PRODUCTIVE_ASSET: 8,
  VALIDATOR: 9,
  ORACLE: 10,
};

export const REVOCATION_STATES = ['ACTIVE', 'REVOKED'] as const;
export type RevocationState = (typeof REVOCATION_STATES)[number];

export const REVOCATION_STATE_IDS: { readonly [K in RevocationState]: number } = {
  ACTIVE: 1,
  REVOKED: 2,
};

export type ActorDescriptor = {
  readonly schemaVersion: 1;
  readonly actorId: string;
  readonly actorType: ActorType;
  readonly ownerControllerId: string;
  readonly credentialRefs: readonly string[];
  readonly capabilityRefs: readonly string[];
  readonly modelFirmwareRef: string;
  readonly jurisdiction: string;
  readonly revocationState: RevocationState;
  readonly identitySystemRef: string;
};

export function actorTypeFromId(id: number): ActorType | null {
  const found = (Object.entries(ACTOR_TYPE_IDS) as Array<[ActorType, number]>).find(
    ([, value]) => value === id,
  );
  return found ? found[0] : null;
}

export function revocationStateFromId(id: number): RevocationState | null {
  if (id === 1) {
    return 'ACTIVE';
  }
  if (id === 2) {
    return 'REVOKED';
  }
  return null;
}

export function actorRequiresCapability(type: ActorType): boolean {
  return type === 'AI_AGENT' || type === 'ROBOT';
}

export function actorIsUnrestrictedWallet(actor: ActorDescriptor): boolean {
  return actorRequiresCapability(actor.actorType) && actor.capabilityRefs.length === 0;
}
