/**
 * HELIOS FORWARD ALPHA — ALPHA07 anytime-valid sequential evidence engine.
 * Research / simulation only. Does not issue Execution Authority.
 */

export const HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA =
  'sunrey.helios.forward-alpha.alpha07-sequential-evidence.v1' as const;

export const RETURN_DEPENDENCE_ASSUMPTIONS = [
  'IID_APPROXIMATION_ACCEPTABLE',
  'WEAK_DEPENDENCE_SUPPORTED',
  'DEPENDENCE_REQUIRES_BLOCK_METHOD',
  'ASSUMPTIONS_FAILED',
] as const;

export type ReturnDependenceAssumption = (typeof RETURN_DEPENDENCE_ASSUMPTIONS)[number];

export const SEQUENTIAL_EVIDENCE_METHODS = [
  'NONE',
  'BOUNDED_CONFIDENCE_SEQUENCE',
  'BLOCK_CONFIDENCE_SEQUENCE',
  'E_PROCESS_MEAN_EXCESS',
] as const;

export type SequentialEvidenceMethod = (typeof SEQUENTIAL_EVIDENCE_METHODS)[number];

export const ALPHA07_RULE_FLAGS = Object.freeze({
  PREDECLARE_RETURN_BOUNDS: true,
  NO_POST_HOC_WINSORIZATION: true,
  SEQUENTIAL_ONLY_WHEN_ASSUMPTIONS_SATISFIED: true,
  OFFLINE_DIAGNOSTICS_SEPARATE: true,
  GRANTS_EXECUTION_AUTHORITY: false as const,
  SIMULATION_ONLY: true as const,
});

export const HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_QUALIFIED =
  'HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_QUALIFIED' as const;

export const HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_BLOCKED =
  'HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_BLOCKED' as const;
