export {
  HELIOS_OPEN_SOURCE_INTEGRATION_SCHEMA,
  HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_QUALIFIED,
  HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_BLOCKED,
  OPEN_SOURCE_WORK_PACKAGE_IDS,
  type OpenSourceWorkPackageId,
  type OpenSourceWorkPackageStatus,
  type PlatformQualificationGateId,
} from './taxonomy.ts';

export {
  OPEN_SOURCE_WORK_PACKAGE_EVIDENCE,
  buildOpenSourceWorkPackageRegistry,
  openSourceWorkPackageBlockers,
  openSourceWorkPackagesQualified,
  type OpenSourceWorkPackageRow,
} from './work-package-registry.ts';

export { evaluateCanonicalAuthorityAssertions, type CanonicalAuthorityAssertion } from './authority-assertions.ts';
export { evaluateLiveSafetyAssertions, type LiveSafetyAssertion } from './live-safety.ts';

export {
  scanOpenSourceProvenance,
  type OpenSourceProvenanceManifest,
  type ProvenanceScanFinding,
  type UpstreamProvenanceRecord,
} from './provenance-scan.ts';

export {
  buildCapabilityDelta,
  renderCapabilityDeltaMarkdown,
  type CapabilityDeltaRow,
  type CapabilityDimension,
} from './capability-delta.ts';

export type {
  OpenSourceSystemDemoResult,
  SystemDemoStep,
  SystemDemoStepStatus,
} from './system-demo-types.ts';

export {
  evaluateOpenSourceIntegrationQualification,
  type OpenSourceIntegrationQualificationInput,
  type OpenSourceIntegrationQualificationResult,
  type PlatformGateResult,
} from './qualification.ts';
