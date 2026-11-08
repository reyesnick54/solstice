import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { UtcInstant } from '@solstice/domain';

import {
  HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_BLOCKED,
  HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_QUALIFIED,
  HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_SCHEMA,
  CAMPAIGN_LOOP_PHASES,
  CAMPAIGN_RUN_STATES,
  CAMPAIGN_TRIGGER_KINDS,
} from './taxonomy.ts';

export type Alpha17CampaignOrchestratorQualificationInput = {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly qualificationTestPresent?: boolean;
};

export type Alpha17CampaignOrchestratorQualificationResult = {
  readonly schema: typeof HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_SCHEMA;
  readonly marker:
    | typeof HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_QUALIFIED
    | typeof HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_BLOCKED;
  readonly qualified: boolean;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly blockers: readonly string[];
};

const REQUIRED_PATHS = Object.freeze([
  'packages/strategy-lab/src/forward-alpha/campaign-orchestrator/orchestrator.ts',
  'packages/strategy-lab/src/forward-alpha/campaign-orchestrator/runtime.ts',
  'packages/strategy-lab/src/forward-alpha/campaign-orchestrator/lease.ts',
  'packages/strategy-lab/src/forward-alpha/campaign-orchestrator/checkpoint.ts',
  'packages/platform/src/helios/forward-alpha/alpha17/index.ts',
  'packages/platform/src/helios/forward-alpha-evidence/alpha17-campaign-orchestrator.ts',
  'packages/platform/src/helios/research-monitor/proactive/campaign-orchestrator-bridge.ts',
]);

export function evaluateAlpha17CampaignOrchestratorQualification(
  input: Alpha17CampaignOrchestratorQualificationInput,
): Alpha17CampaignOrchestratorQualificationResult {
  const blockers: string[] = [];
  for (const rel of REQUIRED_PATHS) {
    if (!existsSync(join(input.root, rel))) {
      blockers.push(`missing:${rel}`);
    }
  }
  const testPath = join(input.root, 'tests/helios-alpha17-campaign-orchestrator.test.ts');
  if (input.qualificationTestPresent !== false && !existsSync(testPath)) {
    blockers.push('tests/helios-alpha17-campaign-orchestrator.test.ts missing');
  }
  if (CAMPAIGN_RUN_STATES.length !== 9) {
    blockers.push('campaign run state taxonomy incomplete');
  }
  if (CAMPAIGN_LOOP_PHASES.length !== 10) {
    blockers.push('campaign loop phase taxonomy incomplete');
  }
  if (CAMPAIGN_TRIGGER_KINDS.length !== 4) {
    blockers.push('campaign trigger taxonomy incomplete');
  }
  const qualified = blockers.length === 0;
  return Object.freeze({
    schema: HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_SCHEMA,
    marker: qualified
      ? HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_QUALIFIED
      : HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_BLOCKED,
    qualified,
    gitSha: input.gitSha,
    evaluatedAt: input.evaluatedAt,
    blockers: Object.freeze(blockers),
  });
}
