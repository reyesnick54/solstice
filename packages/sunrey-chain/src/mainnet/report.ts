/**
 * MainnetReadinessReport assembly.
 */

import { evaluateReadiness, type EvaluatorPolicy } from './evaluator.ts';
import { isExternalDimension, missingEvidenceIds } from './evidence.ts';
import { collectReadinessArtifactDigests } from '../infra/artifacts.ts';
import { consumeEconomicRc, consumeExternalSecurityReview, consumeFormalAssurance, consumePqc, consumeSupplyChain, consumeTestnetRc } from './consumers.ts';
import {
  custodyReadiness,
  exchangeReadiness,
  interopReadiness,
  oracleReadiness,
  privacyReadiness,
} from './product-readiness.ts';
import { READINESS_DIMENSIONS, type DimensionStatus, type MainnetAuthorizationRecord, type MainnetReadinessReport, type ProductionCapabilityActivation, type ReadinessEvidenceRecord } from './types.ts';
import { MAINNET_READINESS_TOOL_VERSION } from './types.ts';

export const ARCHITECTURE_DISTINCTIONS = Object.freeze([
  'engineering readiness != legal approval',
  'security testing != independent audit',
  'testnet success != mainnet authorization',
  'software custody != licensed custody business',
  'software exchange != licensed exchange',
  'PQC software != production HSM PQC capability',
]);

export function buildReadinessReport(input: {
  readonly records: readonly ReadinessEvidenceRecord[];
  readonly authorizations: readonly MainnetAuthorizationRecord[];
  readonly capabilities: readonly ProductionCapabilityActivation[];
  readonly candidateGenesisHash: string | null;
  readonly policy?: EvaluatorPolicy;
  readonly root?: string;
}): MainnetReadinessReport {
  const overall = evaluateReadiness(input.records, input.authorizations, input.policy);
  const perDimension: DimensionStatus[] = READINESS_DIMENSIONS.map((dimension) => {
    const rows = input.records.filter((record) => record.dimension === dimension);
    const missing = rows
      .filter(
        (row) =>
          row.verificationStatus === 'NOT_PROVIDED' ||
          row.verificationStatus === 'EXTERNAL_VERIFICATION_REQUIRED' ||
          row.verificationStatus === 'PROVIDED_UNVERIFIED',
      )
      .map((row) => row.requirementId);
    const status = rows[0]?.verificationStatus ?? 'NOT_PROVIDED';
    return Object.freeze({
      dimension,
      status,
      requirementCount: rows.length,
      missing: Object.freeze(missing),
    });
  });
  const review = consumeExternalSecurityReview();
  const openFindings: string[] = [];
  if (review.status === 'NOT_PROVIDED') {
    openFindings.push('external security review not provided');
  }
  const pqc = consumePqc();
  const supply = consumeSupplyChain(input.root ?? process.cwd());
  const artifacts = collectReadinessArtifactDigests(input.root ?? process.cwd());
  return Object.freeze({
    schemaVersion: 1,
    toolVersion: MAINNET_READINESS_TOOL_VERSION,
    overallEngineeringStatus: overall,
    perDimension: Object.freeze(perDimension),
    perCapability: input.capabilities,
    missingExternalEvidence: Object.freeze(
      missingEvidenceIds(input.records.filter((row) => row.externalEvidence || isExternalDimension(row.dimension))),
    ),
    openSecurityFindings: Object.freeze(openFindings),
    knownLimitations: Object.freeze([
      'Chunks 61–64 engineering artifacts are linked by digest; independent auditor, commercial HSM, counsel, regulator, license, and partner evidence remain incomplete',
      'Simulation ceremony is process readiness only',
      'Zero production allocation; no premint and no testnet faucet copy',
      'LIVE_* flags remain false; ENVIRONMENT remains simulation',
      'PRODUCTION_CANDIDATE infrastructure does not activate mainnet',
      'Chunk 78 economic RC is ENGINEERING_VERIFIED qualification only and does not authorize mainnet',
    ]),
    testnetRcReference: consumeTestnetRc(),
    economicRcReference: consumeEconomicRc(),
    formalEvidence: consumeFormalAssurance(),
    exchangeReadiness: exchangeReadiness(),
    custodyReadiness: custodyReadiness(),
    oracleReadiness: oracleReadiness(),
    interopReadiness: interopReadiness(),
    privacyReadiness: privacyReadiness(),
    pqcStatus: `${pqc.productionStatus}; provider=${pqc.provider}; certifiedHsm=${String(pqc.certifiedHsm)}`,
    supplyChainStatus: `engineering digest=${supply.generatedSourceDigest}; productionSigningKey=null`,
    disasterRecoveryStatus: 'ENGINEERING_VERIFIED (Chunk 55 drills); not a contractual commitment',
    rootOfTrustStatus: 'SIMULATION_REHEARSAL bound; REAL_EXTERNAL_CEREMONY NOT_PROVIDED',
    candidateGenesisHash: input.candidateGenesisHash,
    liveFlagsRemainDisabled: true,
    productionServicesActivated: false,
    distinctions: ARCHITECTURE_DISTINCTIONS,
    infrastructureReadinessDigest: artifacts.infraControlPlaneDigest,
  });
}
