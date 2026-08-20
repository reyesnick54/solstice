import { createHash } from 'node:crypto';

import type { ProductionProviderBinding } from './types.ts';

function stable(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(stable);
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = stable((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

export function bindingDigest(value: unknown): string {
  return createHash('sha256').update(`${JSON.stringify(stable(value))}\n`).digest('hex');
}

export function bindingContentHash(binding: Omit<ProductionProviderBinding, 'contentHash'>): string {
  return bindingDigest({
    bindingId: binding.bindingId,
    providerId: binding.providerId,
    providerDomain: binding.providerDomain,
    providerProfileVersion: binding.providerProfileVersion,
    environmentClass: binding.environmentClass,
    endpointProfileRef: binding.endpointProfileRef,
    credentialDescriptorRef: binding.credentialDescriptorRef,
    credentialVersionRef: binding.credentialVersionRef,
    externalEvidenceRefs: binding.externalEvidenceRefs,
    operatingScopeRefs: binding.operatingScopeRefs,
    legalEntityRef: binding.legalEntityRef,
    jurisdictions: binding.jurisdictions,
    regions: binding.regions,
    dataClasses: binding.dataClasses,
    allowedOperations: binding.allowedOperations,
    primary: binding.primary,
    failoverPriority: binding.failoverPriority,
    failoverBindingId: binding.failoverBindingId,
    runtimeProfileRef: binding.runtimeProfileRef,
    conformanceReportRef: binding.conformanceReportRef,
    acceptanceReportRef: binding.acceptanceReportRef,
    webhookProfileRefs: binding.webhookProfileRefs,
    versionPins: binding.versionPins,
    operationalOwner: binding.operationalOwner,
    controllerId: binding.controllerId,
    credentialAuthorityId: binding.credentialAuthorityId,
    status: binding.status,
    version: binding.version,
    productionConnectivityEnabled: false,
  });
}
