import type { UtcInstant } from '../../../domain/src/time.ts';
import type { CompiledEconomicMandate } from '../mandate/types.ts';
import { isActiveMandate } from '../mandate/lifecycle.ts';
import type { EconomicMandateId, MandateVersion } from '../ids.ts';
import type { HeliosCapability } from './taxonomy.ts';
import type { HeliosFailure, WorkOrderAuthorityBinding } from './types.ts';

export type AuthorityBindingInput = {
  readonly mandate: CompiledEconomicMandate;
  readonly customerId: string;
  readonly capability: HeliosCapability;
  readonly approvalRef: string | null;
  readonly now: UtcInstant;
};

export function bindWorkOrderAuthority(input: AuthorityBindingInput): WorkOrderAuthorityBinding | HeliosFailure {
  if (!isActiveMandate(input.mandate.state)) {
    return {
      code: 'AUTHORITY_REVOKED',
      message: `mandate ${input.mandate.mandateId} is not active`,
    };
  }
  if (!input.mandate.planningEligible) {
    return {
      code: 'CAPABILITY_DENIED',
      message: 'mandate is not planning-eligible',
    };
  }
  return Object.freeze({
    mandateId: input.mandate.mandateId,
    mandateVersion: input.mandate.version,
    approvalRef: input.approvalRef,
    capability: input.capability,
    revalidationState: 'VALID',
    customerId: input.customerId,
    subjectId: input.mandate.subjectId,
    agentMayExpandAuthority: false,
    agentMayIncreaseBudget: false,
  });
}

export function revalidateAuthority(
  binding: WorkOrderAuthorityBinding,
  mandate: CompiledEconomicMandate | undefined,
  paused: boolean,
): WorkOrderAuthorityBinding {
  if (paused) {
    return Object.freeze({ ...binding, revalidationState: 'PAUSED' });
  }
  if (!mandate || mandate.mandateId !== binding.mandateId || mandate.version !== binding.mandateVersion) {
    return Object.freeze({ ...binding, revalidationState: 'STALE_MANDATE' });
  }
  if (!isActiveMandate(mandate.state)) {
    return Object.freeze({ ...binding, revalidationState: 'REVOKED' });
  }
  if (!mandate.planningEligible) {
    return Object.freeze({ ...binding, revalidationState: 'CAPABILITY_DISABLED' });
  }
  return Object.freeze({ ...binding, revalidationState: 'VALID' });
}

export function authorityPermitsDispatch(binding: WorkOrderAuthorityBinding): boolean {
  return binding.revalidationState === 'VALID';
}

export function rejectAuthorityExpansion(
  current: WorkOrderAuthorityBinding,
  proposed: Partial<{
    mandateId: EconomicMandateId;
    mandateVersion: MandateVersion;
    capability: HeliosCapability;
    approvalRef: string | null;
  }>,
): HeliosFailure | null {
  if (proposed.mandateId && proposed.mandateId !== current.mandateId) {
    return { code: 'AUTHORITY_EXPANSION_FORBIDDEN', message: 'worker cannot change mandate reference' };
  }
  if (proposed.mandateVersion !== undefined && proposed.mandateVersion !== current.mandateVersion) {
    return { code: 'AUTHORITY_EXPANSION_FORBIDDEN', message: 'worker cannot upgrade mandate version' };
  }
  if (proposed.capability && proposed.capability !== current.capability) {
    return { code: 'AUTHORITY_EXPANSION_FORBIDDEN', message: 'worker cannot expand capability' };
  }
  if (proposed.approvalRef !== undefined && proposed.approvalRef !== current.approvalRef) {
    return { code: 'AUTHORITY_EXPANSION_FORBIDDEN', message: 'worker cannot modify approval binding' };
  }
  return null;
}
