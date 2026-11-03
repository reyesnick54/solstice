/**
 * NATIVE15 — foreign runtime independence qualification evaluator.
 */

import {
  buildNativeCapabilityParityMatrix,
  type NativeCapabilityParityMatrix,
} from './capability-parity-matrix.ts';
import { scanForeignRuntimeIndependence, type ForeignRuntimeScanResult } from './foreign-runtime-scan.ts';
import {
  auditVendorAssimilationTree,
  scanRuntimeAssimilationImports,
  type VendorAssimilationAuditResult,
} from './vendor-assimilation-audit.ts';
import { buildNativeAssimilationWorkPackageRegistry } from './work-package-registry.ts';
import {
  HELIOS_FOREIGN_RUNTIME_INDEPENDENCE_BLOCKED,
  HELIOS_FOREIGN_RUNTIME_INDEPENDENCE_QUALIFIED,
  HELIOS_NATIVE_ASSIMILATION_SCHEMA,
} from './taxonomy.ts';

export type ForeignRuntimeIndependenceQualificationInput = {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: string;
};

export type ForeignRuntimeIndependenceQualificationResult = {
  readonly schema: typeof HELIOS_NATIVE_ASSIMILATION_SCHEMA;
  readonly marker:
    | typeof HELIOS_FOREIGN_RUNTIME_INDEPENDENCE_QUALIFIED
    | typeof HELIOS_FOREIGN_RUNTIME_INDEPENDENCE_BLOCKED;
  readonly qualified: boolean;
  readonly gitSha: string;
  readonly evaluatedAt: string;
  readonly parityMatrix: NativeCapabilityParityMatrix;
  readonly vendorAudit: VendorAssimilationAuditResult;
  readonly foreignRuntimeScan: ForeignRuntimeScanResult;
  readonly runtimeImportViolations: readonly string[];
  readonly workPackages: ReturnType<typeof buildNativeAssimilationWorkPackageRegistry>;
  readonly blockers: readonly string[];
};

export function evaluateForeignRuntimeIndependenceQualification(
  input: ForeignRuntimeIndependenceQualificationInput,
): ForeignRuntimeIndependenceQualificationResult {
  const parityMatrix = buildNativeCapabilityParityMatrix(input.root);
  const vendorAudit = auditVendorAssimilationTree(input.root);
  const foreignRuntimeScan = scanForeignRuntimeIndependence(input.root);
  const runtimeImportViolations = scanRuntimeAssimilationImports(input.root);
  const workPackages = buildNativeAssimilationWorkPackageRegistry(input.root);

  const blockers: string[] = [];

  if (!parityMatrix.allQualified) {
    blockers.push(...parityMatrix.blockers);
  }
  if (!vendorAudit.pass) {
    blockers.push(...vendorAudit.blockers);
  }
  if (!foreignRuntimeScan.pass) {
    blockers.push(...foreignRuntimeScan.blockers);
  }
  if (runtimeImportViolations.length > 0) {
    blockers.push(
      ...runtimeImportViolations.map((path) => `runtime import from vendor/assimilation: ${path}`),
    );
  }
  for (const row of workPackages) {
    if (row.status !== 'QUALIFIED') {
      blockers.push(`${row.workPackage}: ${row.title}`);
    }
  }

  const qualified = blockers.length === 0;

  return Object.freeze({
    schema: HELIOS_NATIVE_ASSIMILATION_SCHEMA,
    marker: qualified
      ? HELIOS_FOREIGN_RUNTIME_INDEPENDENCE_QUALIFIED
      : HELIOS_FOREIGN_RUNTIME_INDEPENDENCE_BLOCKED,
    qualified,
    gitSha: input.gitSha,
    evaluatedAt: input.evaluatedAt,
    parityMatrix,
    vendorAudit,
    foreignRuntimeScan,
    runtimeImportViolations,
    workPackages,
    blockers: Object.freeze(blockers),
  });
}
