/**
 * ALPHA17 — shadow campaign orchestration (no live capital).
 * Canonical: Strategy Lab forward campaign orchestrator via forward-alpha/alpha17.
 */

export const HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATION = 'HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATION' as const;

export {
  evaluateAlpha17CampaignOrchestratorQualification,
  HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_QUALIFIED,
} from '../forward-alpha/alpha17/index.ts';
