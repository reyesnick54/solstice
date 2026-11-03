import type { EvidenceVault } from '@solstice/evidence';

import type { BiasAssessment } from './types.ts';

export function sealBiasSentinelAssessmentEvidence(
  vault: EvidenceVault | undefined,
  assessment: BiasAssessment,
): string | null {
  if (!vault) {
    return null;
  }
  const sealed = vault.seal('helios.aafv2_5.bias_sentinel.assessment', {
    assessmentId: assessment.assessmentId,
    researchDatasetId: assessment.researchDatasetId,
    strategyGenomeRef: assessment.strategyGenomeRef,
    pointInTimeManifestId: assessment.pointInTimeManifestId,
    coverageTensorDigest: assessment.coverageTensorDigest,
    severity: assessment.severity,
    findingCount: assessment.findings.length,
    dimensions: assessment.findings.map((row) => row.dimension),
    evaluatedAt: assessment.evaluatedAt,
    plane: 'helios_aafv2_5_bias_sentinel',
    grantsExecutionAuthority: false,
    authorizesFinancialExecution: false,
    grantsFinancialEffect: false,
  });
  return sealed.evidenceId;
}
