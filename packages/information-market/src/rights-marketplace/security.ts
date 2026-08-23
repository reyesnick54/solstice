import { createHash } from 'node:crypto';

import { newLicenseeCredentialId } from './ids.ts';
import type { LicensePurpose } from './taxonomy.ts';
import type { LicenseeSecurity, RightsMarketplaceFailure } from './types.ts';

export function issueLicenseeCredentialRef(input: {
  readonly licenseeId: string;
  readonly clientIdentity: string;
  readonly purposeRestrictions: readonly LicensePurpose[];
  readonly rateLimitPerWindow: number;
}): LicenseeSecurity {
  return Object.freeze({
    credentialId: newLicenseeCredentialId(),
    licenseeId: input.licenseeId,
    clientIdentity: input.clientIdentity,
    apiCredentialRef: `secretref:irm:${createHash('sha256').update(input.licenseeId).digest('hex').slice(0, 24)}`,
    rateLimitPerWindow: input.rateLimitPerWindow,
    purposeRestrictions: Object.freeze([...input.purposeRestrictions]),
    auditEnabled: true,
    killSwitch: false,
    incidentSuspension: false,
    secretMaterialIncluded: false,
  });
}

export function evaluateLicenseeGate(security: LicenseeSecurity, purpose: LicensePurpose): RightsMarketplaceFailure | null {
  if (security.killSwitch) {
    return { code: 'KILL_SWITCH', message: 'licensee kill switch is engaged; access is stopped' };
  }
  if (security.incidentSuspension) {
    return { code: 'INCIDENT_SUSPENDED', message: 'licensee is suspended after an incident' };
  }
  if (!security.purposeRestrictions.includes(purpose)) {
    return { code: 'LICENSEE_PURPOSE_RESTRICTED', message: `credential does not permit ${purpose}` };
  }
  return null;
}
