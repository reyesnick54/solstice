import { ENVIRONMENT, LIVE_MONEY_ENABLED } from '../../../../config/src/flags.ts';
import { demoLines } from './report.ts';
import { runParameterizedDualEconomyRehearsal } from './run.ts';

const report = runParameterizedDualEconomyRehearsal();
if (ENVIRONMENT !== 'simulation' || LIVE_MONEY_ENABLED || report.productionAuthorized || report.liveFlagsChanged) {
  throw new Error('parameterized dual-economy rehearsal must remain simulation-only');
}
process.stdout.write(`${demoLines(report).join('\n')}\n`);
