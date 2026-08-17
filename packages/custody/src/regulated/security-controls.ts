import type { ProviderHealthState } from '../../../kernel/src/regulated/providers.ts';
import { INSTITUTIONAL_SECURITY_CONTROLS, type InstitutionalSecurityControl } from '../institutional/taxonomy.ts';

export { INSTITUTIONAL_SECURITY_CONTROLS };
export type CustodySecurityControl = InstitutionalSecurityControl;

export type CustodySecurityControlState = {
  readonly control: CustodySecurityControl;
  readonly engaged: boolean;
  readonly providerHealth: ProviderHealthState;
  readonly reason: string;
};

export function engageControlFromProviderHealth(
  control: CustodySecurityControl,
  health: ProviderHealthState,
): CustodySecurityControlState {
  const engaged = health === 'UNAVAILABLE' || health === 'DEGRADED' || health === 'UNKNOWN';
  return Object.freeze({
    control,
    engaged,
    providerHealth: health,
    reason: engaged ? 'EXTERNAL_PROVIDER_HEALTH' : 'PROVIDER_HEALTHY',
  });
}
