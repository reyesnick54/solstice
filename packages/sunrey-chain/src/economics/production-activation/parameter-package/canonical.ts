/**
 * Deterministic binary encoding for parameter values, candidates, and packages.
 * Never hash unordered JSON.
 */

import { encodeBool, encodeString, encodeU32, sha256Hex } from '../../../validators/canonical.ts';
import type { ProductionParameterId } from '../types.ts';

import type {
  ProductionEconomicParameterPackage,
  ProductionParameterCandidate,
  ProductionParameterCandidateInput,
  ProductionParameterValue,
} from './types.ts';

export const PARAMETER_VALUE_DOMAIN = 'SUNREY_PRODUCTION_ECONOMIC_PARAMETER_VALUE_V1' as const;
export const PARAMETER_CANDIDATE_DOMAIN = 'SUNREY_PRODUCTION_ECONOMIC_PARAMETER_CANDIDATE_V1' as const;
export const PARAMETER_PACKAGE_DOMAIN = 'SUNREY_PRODUCTION_ECONOMIC_PARAMETER_PACKAGE_V1' as const;
export const PARAMETER_RECEIPT_DOMAIN = 'SUNREY_PRODUCTION_ECONOMIC_PARAMETER_RECEIPT_V1' as const;

export function encodeBigint(value: bigint): Buffer {
  const sign = value < 0n ? 1 : 0;
  const magnitude = value < 0n ? -value : value;
  return Buffer.concat([Buffer.from([sign]), encodeString(magnitude.toString(10))]);
}

function encodeOptionalString(value: string | null | undefined): Buffer {
  return encodeString(value ?? '');
}

function encodeStringList(values: readonly string[]): Buffer {
  const ordered = [...values].sort();
  return Buffer.concat([encodeU32(ordered.length), ...ordered.map((row) => encodeString(row))]);
}

export function encodeParameterValue(value: ProductionParameterValue | null): Buffer {
  if (value === null) {
    return Buffer.concat([encodeString('UNCONFIGURED')]);
  }
  const head = [encodeString(value.kind)];
  switch (value.kind) {
    case 'QUANTITY':
      return Buffer.concat([
        ...head,
        encodeBigint(value.minorUnits),
        encodeString(value.precisionReference),
        encodeU32(value.protocolPrecision),
        encodeString(value.assetId),
      ]);
    case 'RATIONAL_CONVERSION':
      return Buffer.concat([...head, encodeBigint(value.numerator), encodeBigint(value.denominator)]);
    case 'CAP_SCHEDULE': {
      const caps = [...value.caps].sort((a, b) => {
        const left = `${a.scope}:${a.classOrCategory ?? ''}`;
        const right = `${b.scope}:${b.classOrCategory ?? ''}`;
        return left < right ? -1 : left > right ? 1 : a.quantityMinorUnits < b.quantityMinorUnits ? -1 : 1;
      });
      return Buffer.concat([
        ...head,
        encodeString(value.assetId),
        encodeU32(caps.length),
        ...caps.flatMap((cap) => [
          encodeString(cap.scope),
          encodeOptionalString(cap.classOrCategory),
          encodeBigint(cap.quantityMinorUnits),
        ]),
      ]);
    }
    case 'ISSUANCE_POLICY_REFERENCE':
      return Buffer.concat([...head, encodeString(value.assetId), encodeString(value.policyVersion)]);
    case 'SUPPLY_GUARD_POLICY':
      return Buffer.concat([
        ...head,
        encodeString(value.assetId),
        encodeOptionalString(value.maximumSupplyRef),
        encodeOptionalString(value.genesisSupplyRef),
        encodeString(String(value.postGenesisIssuanceEnabled)),
        encodeString(value.supplyBookAuthority),
        encodeBool(value.preventIssuanceAboveMaximum),
        encodeBool(value.preventNegativeSupply),
        encodeBool(value.preventHiddenPremint),
        encodeBool(value.preventFaucetMigration),
        encodeBool(value.preventRehearsalBalanceMigration),
        encodeBool(value.preventAutomaticApplicationLedgerMigration),
        encodeBool(value.reconciliationRequiredBeforeIssuance),
        encodeString(value.issuedSupplyObserved === 'UNCONFIGURED' ? 'UNCONFIGURED' : ''),
        value.issuedSupplyObserved === 'UNCONFIGURED' ? Buffer.alloc(0) : encodeBigint(value.issuedSupplyObserved),
      ]);
    case 'FEE_POLICY_REFERENCE':
    case 'BURN_POLICY_REFERENCE':
      return Buffer.concat([...head, encodeString(value.policyVersion)]);
    case 'GENESIS_ALLOCATION_REFERENCE': {
      const lines = [...value.lines].sort((a, b) => {
        const left = `${a.assetId}:${a.category}:${a.recipientRef ?? ''}`;
        const right = `${b.assetId}:${b.category}:${b.recipientRef ?? ''}`;
        return left < right ? -1 : left > right ? 1 : 0;
      });
      return Buffer.concat([
        ...head,
        encodeString(value.manifestRef),
        encodeU32(lines.length),
        ...lines.flatMap((line) => [
          encodeString(line.assetId),
          encodeString(line.category),
          encodeBigint(line.quantityMinorUnits),
          encodeOptionalString(line.recipientRef),
        ]),
        encodeBigint(value.totalByAsset.SUNREY_COIN),
        encodeBigint(value.totalByAsset.MOONREY_COIN),
      ]);
    }
    default: {
      const _never: never = value;
      return encodeString(String(_never));
    }
  }
}

export function hashParameterCandidate(input: ProductionParameterCandidateInput): string {
  const payload = Buffer.concat([
    encodeString(PARAMETER_CANDIDATE_DOMAIN),
    encodeU32(1),
    encodeString(input.parameterId),
    encodeString(input.valueKind),
    encodeParameterValue(input.value),
    encodeString(input.versionId),
    encodeString(input.sourceClass),
    encodeString(input.createdAt),
    input.effectiveHeightCandidate === null ? encodeString('') : encodeBigint(input.effectiveHeightCandidate),
    encodeOptionalString(input.supersedesVersion),
    encodeOptionalString(input.governanceReference),
    encodeStringList(input.externalEvidenceReferences),
    encodeStringList(input.humanApprovalReferences),
    encodeBool(input.fixture),
    encodeBool(input.rehearsalOnly),
    encodeOptionalString(input.alias ?? null),
    encodeString(assetOf(input)),
  ]);
  return sha256Hex(payload);
}

function assetOf(input: ProductionParameterCandidateInput): string {
  if (input.value === null) {
    return 'UNCONFIGURED';
  }
  if ('assetId' in input.value) {
    return String(input.value.assetId);
  }
  return 'SHARED';
}

export function finalizeCandidate(input: ProductionParameterCandidateInput): ProductionParameterCandidate {
  return Object.freeze({
    ...input,
    externalEvidenceReferences: Object.freeze([...input.externalEvidenceReferences]),
    humanApprovalReferences: Object.freeze([...input.humanApprovalReferences]),
    parameterHash: hashParameterCandidate(input),
    productionActivated: false,
  });
}

export function hashParameterPackage(input: {
  readonly packageId: string;
  readonly schemaVersion: number;
  readonly packageVersion: string;
  readonly sourceCommit: string;
  readonly parameters: readonly ProductionParameterCandidate[];
  readonly bindings: readonly { readonly key: string; readonly versionId: string; readonly contentHash: string }[];
  readonly governanceEvidence: readonly { readonly evidenceId: string; readonly contentHash: string }[];
  readonly externalEvidence: readonly { readonly evidenceId: string; readonly contentHash: string }[];
  readonly humanEvidence: readonly { readonly evidenceId: string; readonly contentHash: string }[];
  readonly supersedes: string | null;
  readonly supersededBy: string | null;
  readonly state: string;
}): string {
  const parameters = [...input.parameters].sort((a, b) => (a.parameterId < b.parameterId ? -1 : 1));
  const bindings = [...input.bindings].sort((a, b) => (a.key < b.key ? -1 : 1));
  const gov = [...input.governanceEvidence].sort((a, b) => (a.evidenceId < b.evidenceId ? -1 : 1));
  const ext = [...input.externalEvidence].sort((a, b) => (a.evidenceId < b.evidenceId ? -1 : 1));
  const human = [...input.humanEvidence].sort((a, b) => (a.evidenceId < b.evidenceId ? -1 : 1));
  const payload = Buffer.concat([
    encodeString(PARAMETER_PACKAGE_DOMAIN),
    encodeU32(input.schemaVersion),
    encodeString(input.packageId),
    encodeString(input.packageVersion),
    encodeString(input.sourceCommit),
    encodeU32(parameters.length),
    ...parameters.flatMap((row) => [encodeString(row.parameterId), encodeString(row.parameterHash)]),
    encodeU32(bindings.length),
    ...bindings.flatMap((row) => [encodeString(row.key), encodeString(row.versionId), encodeString(row.contentHash)]),
    encodeStringList(gov.map((row) => `${row.evidenceId}:${row.contentHash}`)),
    encodeStringList(ext.map((row) => `${row.evidenceId}:${row.contentHash}`)),
    encodeStringList(human.map((row) => `${row.evidenceId}:${row.contentHash}`)),
    encodeOptionalString(input.supersedes),
    encodeOptionalString(input.supersededBy),
    encodeString(input.state),
    encodeBool(false),
    encodeBool(false),
  ]);
  return sha256Hex(payload);
}

export function hashReceiptParts(parts: readonly string[]): string {
  return sha256Hex(Buffer.concat([encodeString(PARAMETER_RECEIPT_DOMAIN), ...parts.map((part) => encodeString(part))]));
}

export function parameterIdsOf(parameters: readonly { readonly parameterId: ProductionParameterId }[]): ProductionParameterId[] {
  return parameters.map((row) => row.parameterId);
}
