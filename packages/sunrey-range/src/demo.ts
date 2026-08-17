import { runSmokeCampaign } from './campaign.ts';
import { SCENARIO_CATALOG } from './catalog.ts';
import { createRangeEnvironment } from './environment.ts';
import { catalogComplete, invariantIds } from './invariants.ts';

const env = createRangeEnvironment(57);
const report = runSmokeCampaign();
if (!catalogComplete() || SCENARIO_CATALOG.length < 50 || report.failed > 0) {
  throw new Error(`range demo failed catalog=${SCENARIO_CATALOG.length} failed=${report.failed}`);
}
console.log('sunrey-range demo');
console.log(`  environment ${env.networkId} / ${env.chainId} validators=7 credentials=${env.credentials}`);
console.log(`  catalog ${SCENARIO_CATALOG.length} invariants=${invariantIds().length}`);
console.log(`  smoke ${report.passed}/${report.scenarioCount} passed`);
console.log(`  scorecard ${report.scorecard.label} marketing=${String(!report.scorecard.notAMarketingRating)}`);
console.log('demo ok — isolated adversarial range; no external targets');
