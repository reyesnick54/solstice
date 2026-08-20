import { authorizeCredentialBinding } from '../../../../security/src/regulated/credentials/binding.ts';
import type { CredentialOperation } from '../../../../security/src/regulated/credentials/types.ts';
import type { ProviderDomain } from '../types.ts';
import {
  bindingErr,
  bindingOk,
  type BindingCredentialRecord,
  type BindingEnvironmentClass,
  type BindingResult,
  type ProductionProviderBinding,
} from './types.ts';

export function sandboxCannotSatisfyProduction(
  bindingEnvironment: BindingEnvironmentClass,
  credentialEnvironment: BindingEnvironmentClass,
): boolean {
  return bindingEnvironment === 'PRODUCTION_CANDIDATE' && credentialEnvironment === 'SANDBOX';
}

export function sandboxPlusProductionEligibleIsForbidden(
  sandboxFlag: boolean,
  productionEligibleFlag: boolean,
): boolean {
  return sandboxFlag && productionEligibleFlag;
}

export function authorizeBindingCredential(input: {
  readonly binding: ProductionProviderBinding;
  readonly credential: BindingCredentialRecord;
  readonly nowUtc: string;
  readonly operation: CredentialOperation;
}): BindingResult<true> {
  if (sandboxCannotSatisfyProduction(input.binding.environmentClass, input.credential.environmentClass)) {
    return bindingErr(
      'SANDBOX_CREDENTIAL_CANNOT_SATISFY_PRODUCTION',
      'sandbox credentials cannot satisfy a production-candidate binding',
    );
  }
  if (input.credential.descriptor.providerId !== input.binding.providerId) {
    return bindingErr(
      'CREDENTIAL_PROVIDER_MISMATCH',
      `credential for ${input.credential.descriptor.providerId} cannot bind ${input.binding.providerId}`,
    );
  }
  if (input.credential.descriptor.providerDomain !== input.binding.providerDomain) {
    return bindingErr(
      'PROVIDER_DOMAIN_MISMATCH',
      `credential domain ${input.credential.descriptor.providerDomain} does not match ${input.binding.providerDomain}`,
    );
  }
  if (input.credential.descriptor.credentialId !== input.binding.credentialDescriptorRef) {
    return bindingErr('CREDENTIAL_PROVIDER_MISMATCH', 'credential descriptor does not match the binding reference');
  }
  const authorized = authorizeCredentialBinding({
    credential: input.credential.descriptor,
    workload: input.credential.descriptor.workloadIdentity,
    providerDomain: input.binding.providerDomain,
    operation: input.operation,
    providerId: input.binding.providerId,
    endpointProfileRef: input.binding.endpointProfileRef,
    now: input.nowUtc,
  });
  if (!authorized.ok) {
    return bindingErr(authorized.error.code, authorized.error.reason);
  }
  return bindingOk(true);
}

export function assertDomainAlignment(bindingDomain: ProviderDomain, credentialDomain: ProviderDomain): BindingResult<true> {
  if (bindingDomain !== credentialDomain) {
    return bindingErr('PROVIDER_DOMAIN_MISMATCH', `provider domain ${credentialDomain} cannot bind ${bindingDomain}`);
  }
  return bindingOk(true);
}
