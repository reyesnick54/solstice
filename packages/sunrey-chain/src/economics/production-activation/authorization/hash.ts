import { encodeBool, encodeString, encodeU32, sha256Hex } from '../../../validators/canonical.ts';

import {
  PRODUCTION_ECONOMIC_AUTHORIZATION_DOMAIN,
  PRODUCTION_ECONOMIC_AUTHORIZATION_SCHEMA_VERSION,
  type AuthorizationParameterStatusRow,
  type ProductionEconomicAuthorizationInput,
} from './types.ts';

export function encodeOptionalString(value: string | null | undefined): Buffer {
  return encodeString(value ?? '');
}

export function hashAuthorizationMaterial(input: ProductionEconomicAuthorizationInput): string {
  const statuses = [...input.parameterStatuses].sort((left, right) =>
    left.parameterId < right.parameterId ? -1 : 1,
  );
  const payload = Buffer.concat([
    encodeString(PRODUCTION_ECONOMIC_AUTHORIZATION_DOMAIN),
    encodeU32(PRODUCTION_ECONOMIC_AUTHORIZATION_SCHEMA_VERSION),
    encodeString(input.packageId),
    encodeString(input.parameterPackageHash),
    encodeString(input.sunreyPolicyHash),
    encodeString(input.moonreyPolicyHash),
    encodeString(input.economicConstitutionCandidateHash),
    encodeString(input.economicRcHash),
    encodeString(input.fullPlatformCandidateHash),
    encodeString(input.externalEvidenceBundleHash),
    encodeString(input.operatingScopeMatrixHash),
    encodeString(input.providerBindingMatrixHash),
    encodeString(input.architectureManifestHash),
    encodeString(input.sourceCommit),
    encodeU32(statuses.length),
    ...statuses.flatMap((row) => encodeStatus(row)),
    encodeString(input.approvalWindow.validFromUtc),
    encodeString(input.approvalWindow.validUntilUtc),
    encodeString(input.networkId),
    encodeString(input.chainId),
    encodeString(input.parameterDiffHash),
    encodeString(input.genesisManifestHash),
    encodeOptionalString(input.supersededBy ?? null),
    encodeBool(false),
    encodeBool(false),
  ]);
  return sha256Hex(payload);
}

function encodeStatus(row: AuthorizationParameterStatusRow): Buffer[] {
  return [
    encodeString(row.parameterId),
    encodeString(row.firewallStatus),
    encodeString(row.authorizationClass),
    encodeString(row.sourceClass),
    encodeBool(row.rehearsalReference),
    encodeBool(row.productionEligible),
  ];
}

export function hashOrderedStrings(domain: string, values: readonly string[]): string {
  const ordered = [...values].sort();
  return sha256Hex(
    Buffer.concat([encodeString(domain), encodeU32(ordered.length), ...ordered.map((row) => encodeString(row))]),
  );
}
