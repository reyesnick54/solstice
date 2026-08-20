/**
 * Read-only industrial gateway profiles.
 *
 * Connector profiles point at an approved OT/IT gateway. They never
 * command PLCs, robots, or SCADA actuators. Public arbitrary access
 * into industrial control networks is refused.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import type { ProviderEndpointProfile } from '../../runtime-types.ts';
import {
  approveEndpointProfile,
  classifyHostname,
  enforceSsrfPolicy,
  type ResolvedDestination,
} from '../../security-policy.ts';
import type { ProductionOracleRejection } from '../../types.ts';
import type { ManufacturingSourceClass } from './types.ts';

export const INDUSTRIAL_GATEWAY_PROFILE_VERSION = 'sunrey.manufacturing.ot-it-gateway.v1' as const;

export type ManufacturingGatewayProfile = ProviderEndpointProfile & {
  readonly profileVersion: typeof INDUSTRIAL_GATEWAY_PROFILE_VERSION;
  readonly sourceClass: ManufacturingSourceClass;
  readonly readOnly: true;
  readonly industrialControlAllowed: false;
  readonly commandsPlc: false;
  readonly commandsRobot: false;
  readonly commandsScada: false;
};

export function readOnlyIndustrialGatewayProfile(input: {
  readonly profileId: string;
  readonly providerId: string;
  readonly sourceId: string;
  readonly sourceClass: ManufacturingSourceClass;
  readonly hostname: string;
  readonly port?: number;
  readonly pathPrefix?: string;
}): ManufacturingGatewayProfile {
  return Object.freeze({
    profileId: input.profileId,
    providerId: input.providerId,
    sourceId: input.sourceId,
    scheme: 'https',
    hostname: input.hostname,
    port: input.port ?? 443,
    pathPrefix: input.pathPrefix ?? '/oracle/manufacturing/read',
    allowedMethods: Object.freeze(['GET'] as const),
    authenticationClass: 'PRIVATE_NETWORK',
    tlsPolicy: 'REQUIRE_VALID_CERTIFICATE',
    maximumResponseBytes: 8_192,
    timeoutMs: 1_000,
    redirectPolicy: 'NONE',
    maxRedirects: 0,
    networkClass: 'PRIVATE_NETWORK',
    allowedContentTypes: Object.freeze(['application/json']),
    profileVersion: INDUSTRIAL_GATEWAY_PROFILE_VERSION,
    sourceClass: input.sourceClass,
    readOnly: true,
    industrialControlAllowed: false,
    commandsPlc: false,
    commandsRobot: false,
    commandsScada: false,
  });
}

export function publicInternetIndustrialAccessForbidden(
  profile: ManufacturingGatewayProfile,
  destination: ResolvedDestination,
): Result<true, ProductionOracleRejection> {
  if (profile.networkClass !== 'PRIVATE_NETWORK' || profile.authenticationClass !== 'PRIVATE_NETWORK') {
    return err({
      code: 'SSRF_DESTINATION_FORBIDDEN',
      detail: 'industrial source networks require PRIVATE_NETWORK authentication and network mode',
    });
  }
  const classified = classifyHostname(destination.hostname);
  if (classified === 'PUBLIC_INTERNET') {
    return err({
      code: 'SSRF_DESTINATION_FORBIDDEN',
      detail: 'public arbitrary access into industrial control networks is forbidden',
    });
  }
  const approved = approveEndpointProfile(profile, profile.sourceId, profile.providerId);
  if (!approved.ok) {
    return approved;
  }
  return enforceSsrfPolicy(destination, profile, 'FIXTURE');
}

export function gatewayDoesNotCommandEquipment(profile: ManufacturingGatewayProfile): true {
  if (
    profile.readOnly !== true ||
    profile.industrialControlAllowed !== false ||
    profile.commandsPlc !== false ||
    !profile.allowedMethods.every((method) => method === 'GET')
  ) {
    throw new Error('GATEWAY_COMMANDS_EQUIPMENT');
  }
  return true;
}
