/**
 * Validation receipts. CONFIGURED candidate != production activated.
 * Receipts are inert evidence that a package passed (or failed) checks.
 */

import { PRODUCTION_PARAMETER_IDS, type ProductionParameterId } from '../types.ts';

import { hashReceiptParts } from './canonical.ts';
import { definitionFor } from './definitions.ts';
import { externalEvidencePresent, humanEvidencePresent, protocolEvidencePresent } from './governance.ts';
import { type ParameterBlockingCode, type ProductionParameterValidationReceipt } from './types.ts';
import { validateParameterPackage } from './validation.ts';
import type { ProductionEconomicParameterPackageInput } from './types.ts';

const issuedReceipts = new Map<string, ProductionParameterValidationReceipt>();

export function issuedReceipt(hash: string): ProductionParameterValidationReceipt | undefined {
  return issuedReceipts.get(hash);
}

export function rememberReceipt(receipt: ProductionParameterValidationReceipt): ProductionParameterValidationReceipt {
  issuedReceipts.set(receipt.receiptHash, receipt);
  return receipt;
}

export function receiptIsRegistered(hash: string | null | undefined): boolean {
  return typeof hash === 'string' && issuedReceipts.has(hash);
}

function buildReceipt(input: {
  readonly packageHash: string;
  readonly parameterId: ProductionParameterId;
  readonly parameterHash: string;
  readonly schemaValid: boolean;
  readonly typeValid: boolean;
  readonly dependenciesValid: boolean;
  readonly crossParameterValid: boolean;
  readonly governanceEvidencePresent: boolean;
  readonly externalEvidencePresent: boolean;
  readonly humanEvidencePresent: boolean;
  readonly fixture: boolean;
  readonly rehearsalOnly: boolean;
  readonly blockingCodes: readonly ParameterBlockingCode[];
}): ProductionParameterValidationReceipt {
  const candidateConfigured =
    input.schemaValid &&
    input.typeValid &&
    input.dependenciesValid &&
    input.crossParameterValid &&
    input.parameterHash !== '';
  const productionGovernanceComplete =
    candidateConfigured &&
    !input.fixture &&
    !input.rehearsalOnly &&
    input.governanceEvidencePresent &&
    input.humanEvidencePresent &&
    (!definitionFor(input.parameterId).requiresExternalEvidence || input.externalEvidencePresent);
  const receiptHash = hashReceiptParts([
    input.packageHash,
    input.parameterId,
    input.parameterHash,
    input.schemaValid ? '1' : '0',
    input.typeValid ? '1' : '0',
    input.dependenciesValid ? '1' : '0',
    input.crossParameterValid ? '1' : '0',
    input.governanceEvidencePresent ? '1' : '0',
    input.externalEvidencePresent ? '1' : '0',
    input.humanEvidencePresent ? '1' : '0',
    input.fixture ? '1' : '0',
    input.rehearsalOnly ? '1' : '0',
    candidateConfigured ? '1' : '0',
    productionGovernanceComplete ? '1' : '0',
    input.blockingCodes.join(','),
    'productionActivated:false',
  ]);
  return rememberReceipt(
    Object.freeze({
      packageHash: input.packageHash,
      parameterId: input.parameterId,
      parameterHash: input.parameterHash,
      schemaValid: input.schemaValid,
      typeValid: input.typeValid,
      dependenciesValid: input.dependenciesValid,
      crossParameterValid: input.crossParameterValid,
      governanceEvidencePresent: input.governanceEvidencePresent,
      externalEvidencePresent: input.externalEvidencePresent,
      humanEvidencePresent: input.humanEvidencePresent,
      fixture: input.fixture,
      rehearsalOnly: input.rehearsalOnly,
      candidateConfigured,
      productionGovernanceComplete,
      blockingCodes: Object.freeze([...input.blockingCodes]),
      receiptHash,
      productionActivated: false,
    }),
  );
}

export function receiptsForPackage(input: ProductionEconomicParameterPackageInput): readonly ProductionParameterValidationReceipt[] {
  const validated = validateParameterPackage(input);
  const hasGov = protocolEvidencePresent(input.governanceEvidence) || humanEvidencePresent(input.humanEvidence);
  const hasHuman = humanEvidencePresent(input.humanEvidence);
  const hasExternal = externalEvidencePresent(input.externalEvidence);
  const receipts = PRODUCTION_PARAMETER_IDS.map((id) => {
    const row = validated.coverage.rows.find((item) => item.parameterId === id)!;
    const candidate = validated.finalized.find((item) => item.parameterId === id);
    const blocking = row.blockingCodes;
    return buildReceipt({
      packageHash: validated.package.packageHash,
      parameterId: id,
      parameterHash: candidate?.parameterHash ?? '',
      schemaValid: input.schemaVersion === 1,
      typeValid: !blocking.some((code) =>
        [
          'VALUE_KIND_MISMATCH',
          'FLOAT_QUANTITY_REJECTED',
          'NON_BIGINT_QUANTITY',
          'NEGATIVE_QUANTITY',
          'NEGATIVE_CAP',
          'RATIONAL_DENOMINATOR_ZERO',
          'RATIONAL_DENOMINATOR_NEGATIVE',
        ].includes(code),
      ),
      dependenciesValid: !blocking.includes('DEPENDENCY_MISSING'),
      crossParameterValid: !blocking.some((code) =>
        ['GENESIS_EXCEEDS_MAXIMUM', 'ISSUANCE_CAP_EXCEEDS_MAXIMUM', 'ISSUED_EXCEEDS_MAXIMUM', 'ALLOCATION_SUM_MISMATCH'].includes(
          code,
        ),
      ),
      governanceEvidencePresent: hasGov,
      externalEvidencePresent: hasExternal,
      humanEvidencePresent: hasHuman,
      fixture: candidate?.fixture === true,
      rehearsalOnly: candidate?.rehearsalOnly === true,
      blockingCodes: blocking,
    });
  });
  return Object.freeze(receipts);
}

export function missingReceiptBlock(): ParameterBlockingCode {
  return 'MISSING_VALIDATION_RECEIPT';
}
