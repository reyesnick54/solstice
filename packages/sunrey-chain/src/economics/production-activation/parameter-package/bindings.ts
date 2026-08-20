/**
 * Bind a validated parameter package to Chunk 143 ProductionParameterRecord.
 *
 * Manual { governed: true, sourceClass: "PRODUCTION" } records cannot
 * become CONFIGURED. Only a registered validation receipt can.
 */

import type { ProductionParameterId, ProductionParameterRecord } from '../types.ts';
import { unconfiguredParameter } from '../parameters.ts';

import { issuedReceipt, receiptsForPackage } from './receipt.ts';
import { validateParameterPackage } from './validation.ts';
import type {
  ProductionEconomicParameterPackage,
  ProductionEconomicParameterPackageInput,
  ProductionParameterCandidate,
  ProductionParameterValidationReceipt,
} from './types.ts';

export function productionParameterRecordFromValidatedCandidate(
  candidate: ProductionParameterCandidate,
  receipt: ProductionParameterValidationReceipt,
): ProductionParameterRecord {
  const registered = issuedReceipt(receipt.receiptHash);
  if (!registered || registered.parameterHash !== candidate.parameterHash) {
    return unconfiguredParameter(candidate.parameterId);
  }
  if (!receipt.candidateConfigured || candidate.value === null) {
    return Object.freeze({
      ...unconfiguredParameter(candidate.parameterId),
      sourceClass: candidate.sourceClass,
      versionId: candidate.versionId,
      valueHash: candidate.parameterHash,
      validationReceiptHash: receipt.receiptHash,
      governed: false,
    });
  }
  const rejected =
    receipt.blockingCodes.includes('ARBITRARY_SOURCE_CLASS') ||
    receipt.blockingCodes.includes('PRODUCTION_SOURCE_CLASS_REJECTED');
  return Object.freeze({
    id: candidate.parameterId,
    status: rejected ? 'REJECTED_SOURCE' : 'CONFIGURED',
    sourceClass: candidate.sourceClass,
    versionId: candidate.versionId,
    valueHash: candidate.parameterHash,
    governed: true,
    infrastructureMetadataOnly: false,
    validationReceiptHash: receipt.receiptHash,
  });
}

export function productionParameterRecordsFromPackage(
  input: ProductionEconomicParameterPackageInput | ProductionEconomicParameterPackage,
): readonly ProductionParameterRecord[] {
  const validated = validateParameterPackage({
    packageId: input.packageId,
    schemaVersion: input.schemaVersion,
    packageVersion: input.packageVersion,
    sourceCommit: input.sourceCommit,
    parameters: input.parameters,
    bindings: input.bindings,
    governanceEvidence: input.governanceEvidence,
    externalEvidence: input.externalEvidence,
    humanEvidence: input.humanEvidence,
    supersedes: input.supersedes,
    supersededBy: input.supersededBy,
  });
  const receipts = receiptsForPackage(validated.package);
  return Object.freeze(
    validated.package.parameters.length === 0
      ? []
      : validated.finalized.map((candidate) => {
          const receipt = receipts.find((row) => row.parameterId === candidate.parameterId);
          if (!receipt) {
            return unconfiguredParameter(candidate.parameterId);
          }
          return productionParameterRecordFromValidatedCandidate(candidate, receipt);
        }),
  );
}

export function recordHasValidReceipt(record: ProductionParameterRecord): boolean {
  const hash = record.validationReceiptHash ?? null;
  if (!hash) {
    return false;
  }
  const receipt = issuedReceipt(hash);
  return (
    receipt !== undefined &&
    receipt.parameterId === record.id &&
    receipt.candidateConfigured &&
    receipt.productionActivated === false
  );
}

export function configuredIdsFromPackage(
  input: ProductionEconomicParameterPackageInput,
): readonly ProductionParameterId[] {
  return productionParameterRecordsFromPackage(input)
    .filter((row) => row.status === 'CONFIGURED')
    .map((row) => row.id);
}
