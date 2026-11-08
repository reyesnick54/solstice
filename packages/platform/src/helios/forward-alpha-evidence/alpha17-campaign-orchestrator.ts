/**
 * ALPHA17 — forward campaign orchestrator evidence binding.
 */

import type { UtcInstant } from '@solstice/domain';
import {
  evaluateAlpha17CampaignOrchestratorQualification,
  HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_BLOCKED,
  HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_QUALIFIED,
  HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_SCHEMA,
  type Alpha17CampaignOrchestratorQualificationResult,
} from '@solstice/strategy-lab';

export {
  HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_SCHEMA,
  HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_QUALIFIED,
  HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_BLOCKED,
} from '@solstice/strategy-lab';

export type Alpha17ForwardCampaignEvidenceRecord = {
  readonly schema: typeof HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_SCHEMA;
  readonly campaignId: string;
  readonly checkpointGeneration: number;
  readonly sealedDecisionCount: number;
  readonly runState: string;
  readonly evidenceRef: string;
  readonly recordedAt: UtcInstant;
};

export function bindAlpha17CampaignEvidence(input: {
  readonly campaignId: string;
  readonly checkpointGeneration: number;
  readonly sealedDecisionCount: number;
  readonly runState: string;
  readonly evidenceRef: string;
  readonly recordedAt: UtcInstant;
}): Alpha17ForwardCampaignEvidenceRecord {
  return Object.freeze({
    schema: HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_SCHEMA,
    campaignId: input.campaignId,
    checkpointGeneration: input.checkpointGeneration,
    sealedDecisionCount: input.sealedDecisionCount,
    runState: input.runState,
    evidenceRef: input.evidenceRef,
    recordedAt: input.recordedAt,
  });
}

export function evaluateAlpha17ForwardCampaignEvidenceQualification(input: {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
}): Alpha17CampaignOrchestratorQualificationResult {
  return evaluateAlpha17CampaignOrchestratorQualification(input);
}
