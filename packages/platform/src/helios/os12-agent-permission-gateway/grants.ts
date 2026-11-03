import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { EconomicWorkOrderId } from '../ids.ts';
import {
  defaultResearchAgentPermissions,
  forbiddenPermissionsForResearchAgents,
  isForbiddenPermission,
} from './permission-catalog.ts';
import { newAgentCapabilityGrantId, type AgentCapabilityGrantId } from './ids.ts';
import type { AgentCapabilityGrant } from './types.ts';
import type { AgentResearchPermission } from './taxonomy.ts';

export type CreateAgentCapabilityGrantInput = {
  readonly customerId: CustomerId;
  readonly workOrderId: EconomicWorkOrderId | null;
  readonly agentLabel: string;
  readonly permissions?: readonly AgentResearchPermission[];
  readonly expiresAt?: UtcInstant | null;
  readonly now: UtcInstant;
  readonly grantId?: AgentCapabilityGrantId;
};

export function createAgentCapabilityGrant(
  input: CreateAgentCapabilityGrantInput,
): AgentCapabilityGrant {
  const permissions = Object.freeze(
    input.permissions ?? defaultResearchAgentPermissions(),
  ) as readonly AgentResearchPermission[];

  for (const permission of permissions) {
    if (isForbiddenPermission(permission)) {
      throw new Error(`forbidden permission cannot be granted: ${permission}`);
    }
  }

  return Object.freeze({
    grantId: input.grantId ?? newAgentCapabilityGrantId(),
    customerId: input.customerId,
    workOrderId: input.workOrderId,
    agentLabel: input.agentLabel,
    permissions,
    forbiddenPermissions: forbiddenPermissionsForResearchAgents(),
    state: 'ACTIVE',
    issuedAt: input.now,
    expiresAt: input.expiresAt ?? null,
    revokedAt: null,
    revocable: true,
    grantsExecutionAuthority: false,
    authorizesFinancialExecution: false,
  });
}

export function revokeAgentCapabilityGrant(
  grant: AgentCapabilityGrant,
  now: UtcInstant,
): AgentCapabilityGrant {
  if (grant.state !== 'ACTIVE') {
    return grant;
  }
  return Object.freeze({
    ...grant,
    state: 'REVOKED',
    revokedAt: now,
  });
}
