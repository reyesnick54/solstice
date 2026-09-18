import type {
  HeliosJurisdictionCapabilityPort,
  HeliosJurisdictionCapabilityQueryInput,
  HeliosJurisdictionCapabilityResult,
} from './types.ts';

export const HELIOS_H28_JURISDICTION_CAPABILITY = 'HELIOS_H28_JURISDICTION_CAPABILITY' as const;

export class HeliosJurisdictionCapabilityService {
  private readonly port: HeliosJurisdictionCapabilityPort;

  constructor(port: HeliosJurisdictionCapabilityPort) {
    this.port = port;
  }

  query(input: HeliosJurisdictionCapabilityQueryInput): HeliosJurisdictionCapabilityResult {
    return this.port.query(input);
  }

  isEnabled(input: HeliosJurisdictionCapabilityQueryInput): boolean {
    return this.port.query(input).outcome === 'ALLOWED';
  }

  gateHeliosAction(
    input: HeliosJurisdictionCapabilityQueryInput,
  ): HeliosJurisdictionCapabilityResult {
    return this.port.query(input);
  }
}
