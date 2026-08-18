import {
  DEVELOPER_ROLES,
  PROTOCOL_GOVERNANCE_ROLES,
  type DeveloperPermission,
  type DeveloperRole,
  type WebhookEventType,
  SCOPE_REQUIRED_EVENTS,
} from './types.ts';

export const ROLE_PERMISSIONS: Readonly<Record<DeveloperRole, readonly DeveloperPermission[]>> = Object.freeze({
  OWNER: Object.freeze([
    'CHAIN_READ',
    'TRANSACTION_SUBMIT',
    'WALLET_READ_PUBLIC',
    'WEBHOOK_MANAGE',
    'MARKET_DATA_READ',
    'ORACLE_PUBLIC_READ',
    'MACHINE_PUBLIC_READ',
    'GOVERNANCE_PUBLIC_READ',
    'VALIDATOR_PUBLIC_READ',
    'MONETARY_PUBLIC_READ',
    'FAUCET_REQUEST',
    'SANDBOX_MANAGE',
  ]),
  ADMIN: Object.freeze([
    'CHAIN_READ',
    'TRANSACTION_SUBMIT',
    'WALLET_READ_PUBLIC',
    'WEBHOOK_MANAGE',
    'MARKET_DATA_READ',
    'ORACLE_PUBLIC_READ',
    'MACHINE_PUBLIC_READ',
    'GOVERNANCE_PUBLIC_READ',
    'VALIDATOR_PUBLIC_READ',
    'MONETARY_PUBLIC_READ',
    'FAUCET_REQUEST',
    'SANDBOX_MANAGE',
  ]),
  DEVELOPER: Object.freeze([
    'CHAIN_READ',
    'TRANSACTION_SUBMIT',
    'WALLET_READ_PUBLIC',
    'WEBHOOK_MANAGE',
    'MARKET_DATA_READ',
    'ORACLE_PUBLIC_READ',
    'MACHINE_PUBLIC_READ',
    'GOVERNANCE_PUBLIC_READ',
    'VALIDATOR_PUBLIC_READ',
    'MONETARY_PUBLIC_READ',
    'FAUCET_REQUEST',
    'SANDBOX_MANAGE',
  ]),
  VIEWER: Object.freeze([
    'CHAIN_READ',
    'WALLET_READ_PUBLIC',
    'MARKET_DATA_READ',
    'ORACLE_PUBLIC_READ',
    'MACHINE_PUBLIC_READ',
    'GOVERNANCE_PUBLIC_READ',
    'VALIDATOR_PUBLIC_READ',
    'MONETARY_PUBLIC_READ',
  ]),
});

const ROLE_RANK: Readonly<Record<DeveloperRole, number>> = Object.freeze({
  VIEWER: 1,
  DEVELOPER: 2,
  ADMIN: 3,
  OWNER: 4,
});

export function roleMayManageCredentials(role: DeveloperRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function roleMayMutateApplication(role: DeveloperRole): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'DEVELOPER';
}

export function roleMayView(role: DeveloperRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.VIEWER;
}

export function roleAtLeast(actual: DeveloperRole, required: DeveloperRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export function credentialHasScope(
  granted: readonly DeveloperPermission[],
  required: DeveloperPermission,
): boolean {
  return granted.includes(required);
}

export function eventAuthorizedForScopes(
  eventType: WebhookEventType,
  scopes: readonly DeveloperPermission[],
): boolean {
  return scopes.includes(SCOPE_REQUIRED_EVENTS[eventType]);
}

export function developerRoleCannotBecomeProtocolRole(role: DeveloperRole): true {
  if ((PROTOCOL_GOVERNANCE_ROLES as readonly string[]).includes(role)) {
    throw new Error('developer platform role collided with protocol governance');
  }
  return true;
}

export function assertNotProtocolGovernanceRole(role: string): asserts role is DeveloperRole {
  if ((PROTOCOL_GOVERNANCE_ROLES as readonly string[]).includes(role)) {
    throw new Error('DEVELOPER_ROLE_IS_NOT_PROTOCOL_GOVERNANCE');
  }
  if (!(DEVELOPER_ROLES as readonly string[]).includes(role)) {
    throw new Error('UNKNOWN_DEVELOPER_ROLE');
  }
}
