import { EU_PACK_COUNTRY_CODES, packIdForCountry } from '../jurisdiction.ts';
import {
  EU_MEMBER_STATE_CODES,
  HELIOS_JURISDICTION_IDS,
  isHeliosJurisdictionId,
  type HeliosJurisdictionId,
} from './taxonomy.ts';
import type { JurisdictionCapabilityPack, JurisdictionOverlay } from './types.ts';

export type ResolvedJurisdictionContext = {
  readonly frameworkJurisdictionId: HeliosJurisdictionId | null;
  readonly overlayId: string | null;
  readonly overlayKey: string | null;
  readonly reasonCode: string;
};

/**
 * Map ISO country / jurisdiction signal to H28 framework jurisdiction + overlay.
 * Does not assume EU-wide permission applies identically in all member states.
 */
export function resolveHeliosJurisdiction(input: {
  readonly jurisdiction: string;
  readonly memberState?: string;
  readonly stateOverlay?: string;
}): ResolvedJurisdictionContext {
  const code = input.jurisdiction.toUpperCase();

  if (code === 'US') {
    const state = input.stateOverlay?.toUpperCase();
    if (state) {
      return Object.freeze({
        frameworkJurisdictionId: 'US',
        overlayId: `us-state-${state.toLowerCase()}`,
        overlayKey: state,
        reasonCode: 'US_STATE_OVERLAY',
      });
    }
    return Object.freeze({
      frameworkJurisdictionId: 'US',
      overlayId: null,
      overlayKey: null,
      reasonCode: 'US_FEDERAL_FRAMEWORK',
    });
  }

  if ((EU_MEMBER_STATE_CODES as readonly string[]).includes(code) || code === 'EU') {
    const member = code === 'EU' ? input.memberState?.toUpperCase() : code;
    if (member && (EU_MEMBER_STATE_CODES as readonly string[]).includes(member)) {
      return Object.freeze({
        frameworkJurisdictionId: 'EU',
        overlayId: `eu-ms-${member.toLowerCase()}`,
        overlayKey: member,
        reasonCode: 'EU_MEMBER_STATE_OVERLAY',
      });
    }
    return Object.freeze({
      frameworkJurisdictionId: 'EU',
      overlayId: null,
      overlayKey: null,
      reasonCode: 'EU_FRAMEWORK_ONLY',
    });
  }

  if (code === 'UK') {
    return Object.freeze({
      frameworkJurisdictionId: 'GB',
      overlayId: null,
      overlayKey: null,
      reasonCode: 'UK_MAPPED_TO_GB',
    });
  }

  if (isHeliosJurisdictionId(code)) {
    return Object.freeze({
      frameworkJurisdictionId: code,
      overlayId: null,
      overlayKey: null,
      reasonCode: 'JURISDICTION_FRAMEWORK_RESOLVED',
    });
  }

  const packId = packIdForCountry(code);
  if (packId && isHeliosJurisdictionId(packId)) {
    return Object.freeze({
      frameworkJurisdictionId: packId,
      overlayId: null,
      overlayKey: null,
      reasonCode: 'POLICY_PACK_MAPPED',
    });
  }

  if ((EU_PACK_COUNTRY_CODES as readonly string[]).includes(code)) {
    return Object.freeze({
      frameworkJurisdictionId: 'EU',
      overlayId: `eu-ms-${code.toLowerCase()}`,
      overlayKey: code,
      reasonCode: 'EU_EEA_MEMBER_OVERLAY',
    });
  }

  if ((HELIOS_JURISDICTION_IDS as readonly string[]).includes(code)) {
    return Object.freeze({
      frameworkJurisdictionId: code as HeliosJurisdictionId,
      overlayId: null,
      overlayKey: null,
      reasonCode: 'JURISDICTION_DIRECT',
    });
  }

  return Object.freeze({
    frameworkJurisdictionId: null,
    overlayId: null,
    overlayKey: null,
    reasonCode: 'JURISDICTION_UNMAPPED',
  });
}

export function findOverlay(
  pack: JurisdictionCapabilityPack,
  overlayId: string | null,
): JurisdictionOverlay | null {
  if (!overlayId) return null;
  return pack.overlays.find((row) => row.overlayId === overlayId) ?? null;
}
