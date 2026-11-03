export {
  HELIOS_NATIVE_ASSIMILATION_SCHEMA,
  HELIOS_FOREIGN_RUNTIME_INDEPENDENCE_QUALIFIED,
  HELIOS_FOREIGN_RUNTIME_INDEPENDENCE_BLOCKED,
  NATIVE_ASSIMILATION_WORK_PACKAGE_IDS,
  FORBIDDEN_FOREIGN_RUNTIME_LABELS,
  type NativeAssimilationWorkPackageId,
  type NativeParityQualificationStatus,
  type UpstreamAssimilationProjectId,
} from './taxonomy.ts';

export {
  NATIVE_CAPABILITY_PARITY_DEFINITIONS,
  buildNativeCapabilityParityMatrix,
  renderNativeCapabilityParityMarkdown,
  type NativeCapabilityParityMatrix,
  type NativeCapabilityParityRow,
} from './capability-parity-matrix.ts';

export {
  auditVendorAssimilationTree,
  scanRuntimeAssimilationImports,
  type VendorAssimilationAuditResult,
  type VendorAssimilationAuditCheck,
} from './vendor-assimilation-audit.ts';

export {
  scanForeignRuntimeIndependence,
  type ForeignRuntimeScanResult,
  type ForeignRuntimeScanCheck,
} from './foreign-runtime-scan.ts';

export {
  buildNativeAssimilationProvenanceManifest,
  type NativeAssimilationProvenanceManifest,
  type NativeAssimilationProvenanceEntry,
} from './provenance-manifest.ts';

export {
  buildNativeAssimilationWorkPackageRegistry,
  type NativeAssimilationWorkPackageRow,
} from './work-package-registry.ts';

export {
  evaluateForeignRuntimeIndependenceQualification,
  type ForeignRuntimeIndependenceQualificationInput,
  type ForeignRuntimeIndependenceQualificationResult,
} from './qualification.ts';
