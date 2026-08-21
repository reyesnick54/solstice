/**
 * Deterministic sandbox personas for frontend development.
 * Fail closed unless ENVIRONMENT is simulation and the runtime
 * explicitly enables sandbox personas.
 */

import { ENVIRONMENT } from '../../../packages/config/src/flags.ts';
import type { IdentityCapability } from '../../../packages/identity/src/capability.ts';
import {
  SANDBOX_PERSONA_IDS,
  type SandboxPersonaId,
} from '../../../packages/sunrey-sdk/src/consumer-platform/index.ts';

export type PersonaDefinition = {
  readonly personaId: SandboxPersonaId;
  readonly label: string;
  readonly actorId: string;
  readonly identityId: string;
  readonly customerId: string;
  readonly capabilities: readonly IdentityCapability[];
  readonly seedAccount: boolean;
  readonly activityCount: number;
};

export const PERSONA_DEFINITIONS: readonly PersonaDefinition[] = Object.freeze([
  {
    personaId: 'alex-ready',
    label: 'Ready consumer with one deposit account',
    actorId: 'actor_alex_ready',
    identityId: 'idn_alex_ready',
    customerId: 'cust_alex_ready',
    capabilities: ['VIEW_ACCOUNT', 'MANAGE_PROFILE'],
    seedAccount: true,
    activityCount: 3,
  },
  {
    personaId: 'blair-restricted',
    label: 'Authenticated user without financial capabilities',
    actorId: 'actor_blair_restricted',
    identityId: 'idn_blair_restricted',
    customerId: 'cust_blair_restricted',
    capabilities: ['MANAGE_PROFILE'],
    seedAccount: false,
    activityCount: 1,
  },
  {
    personaId: 'casey-capable',
    label: 'Consumer who may request account open through Kernel',
    actorId: 'actor_casey_capable',
    identityId: 'idn_casey_capable',
    customerId: 'cust_casey_capable',
    capabilities: ['VIEW_ACCOUNT', 'ACCOUNT_OPEN_REQUEST', 'MANAGE_PROFILE'],
    seedAccount: false,
    activityCount: 2,
  },
  {
    personaId: 'drew-empty',
    label: 'View-capable user with no accounts',
    actorId: 'actor_drew_empty',
    identityId: 'idn_drew_empty',
    customerId: 'cust_drew_empty',
    capabilities: ['VIEW_ACCOUNT', 'MANAGE_PROFILE'],
    seedAccount: false,
    activityCount: 1,
  },
  {
    personaId: 'evan-paged',
    label: 'View-capable user with paginated activity',
    actorId: 'actor_evan_paged',
    identityId: 'idn_evan_paged',
    customerId: 'cust_evan_paged',
    capabilities: ['VIEW_ACCOUNT', 'MANAGE_PROFILE'],
    seedAccount: false,
    activityCount: 25,
  },
]);

export function personaById(personaId: string): PersonaDefinition | undefined {
  return PERSONA_DEFINITIONS.find((row) => row.personaId === personaId);
}

export function sandboxPersonasAllowed(enabled: boolean): boolean {
  return ENVIRONMENT === 'simulation' && enabled === true;
}

export { SANDBOX_PERSONA_IDS };
