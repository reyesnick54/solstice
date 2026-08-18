/**
 * Compare Production Candidate V1 against Candidate V2.
 */

import { buildGenesisCandidate } from '../genesis-candidate.ts';
import { PRODUCTION_CANDIDATE_CHAIN_ID, PRODUCTION_CANDIDATE_NETWORK_ID } from '../identity.ts';
import type { ProductionCandidateComparison, ProductionNetworkCandidateV2 } from './types.ts';
import { CANDIDATE_V2_ID } from './identity.ts';
import { createProductionNetworkCandidateV2 } from './assemble.ts';

export function compareProductionCandidates(
  right?: ProductionNetworkCandidateV2,
  root = process.cwd(),
): ProductionCandidateComparison {
  const v1 = buildGenesisCandidate();
  const v2 = right ?? createProductionNetworkCandidateV2(root);
  return Object.freeze({
    schemaVersion: 1,
    leftId: 'SUNREY_PRODUCTION_NETWORK_CANDIDATE_1',
    rightId: v2.candidateId,
    protocolChanges: Object.freeze([
      `network ${PRODUCTION_CANDIDATE_NETWORK_ID} -> ${v2.configuration.networkId}`,
      `chain ${PRODUCTION_CANDIDATE_CHAIN_ID} -> ${v2.configuration.chainId}`,
      `genesis format ${v1.candidate.genesisVersion} -> ${v2.configuration.genesisFormatVersion}`,
      `protocol bundle digest ${v2.protocolBundleDigest}`,
    ]),
    economicAdditions: Object.freeze([
      `Chunk 76 economic stress bound ${v2.evidence.chunk76StressReportHash}`,
      `Chunk 77 protocol treasury bound ${v2.evidence.chunk77TreasuryPolicyHash}`,
      `Chunk 78 economic RC ${v2.economic.economicRcId}`,
      `Chunk 79 governance operations ${v2.evidence.chunk79GovernancePackageHash}`,
      `Chunk 80 rehearsal evidence ${v2.evidence.chunk80RehearsalEvidenceHash}`,
    ]),
    securityEvidenceChanges: Object.freeze([
      `security bundle ${v2.security.combinedHash}`,
      'independent audit remains NOT_PROVIDED',
      `HSM state ${v2.infrastructure.hsmState}`,
    ]),
    infrastructureChanges: Object.freeze([
      `infrastructure bundle ${v2.infrastructure.combinedHash}`,
      `service manifest ${v2.services.combinedHash}`,
    ]),
    storageChanges: Object.freeze([
      `redb ${v2.storage.redbEngine}@${v2.storage.redbEngineVersion} schema ${v2.storage.storageSchema}`,
    ]),
    validatorChanges: Object.freeze([
      `validator count ${v2.validators.length}`,
      'fixture keys remain not production-eligible',
      `concentration independence claimed=${v2.concentration.organizationalIndependenceClaimed}`,
    ]),
    readinessChanges: Object.freeze([
      `readiness digest ${v2.manifest.readinessEvidenceHash}`,
      'external evidence status not overwritten',
    ]),
    remainingExternalGaps: Object.freeze([
      'legal',
      'regulatory',
      'licensing',
      'partner',
      'external audit',
      'commercial HSM',
      'human authorization',
    ]),
  });
}

export function comparisonMentionsCandidateV2(comparison: ProductionCandidateComparison): boolean {
  return comparison.rightId === CANDIDATE_V2_ID;
}
