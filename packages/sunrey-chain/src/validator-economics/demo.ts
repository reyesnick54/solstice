import { runValidatorEconomicsSimulation } from './simulator.ts';
import { ValidatorEconomicsEngine } from './engine.ts';
import { fixtureValidatorRecord } from './fixtures.ts';
import { productionBondPolicy } from './policy.ts';

const engine = new ValidatorEconomicsEngine('development');
const record = fixtureValidatorRecord({ label: 'A' });
engine.registerValidator(record, 2_000_000n);
const bonded = engine.bond({
  validatorId: record.validatorId,
  quantity: 1_000_000n,
  asset: 'DEVELOPMENT_SUNREY_COIN',
});
if (!bonded.ok) {
  throw new Error(bonded.error.message);
}
engine.advanceEpoch();
const report = runValidatorEconomicsSimulation('development');
if (!report.allPassed) {
  throw new Error('validator economics simulation failed');
}
const reconciliation = engine.reconcile();
if (!reconciliation.balanced) {
  throw new Error('validator economics demo reconciliation failed');
}
console.log('sunrey validator economics demo');
console.log(`  bond state ${engine.getBond(record.validatorId)?.state}`);
console.log(`  development bond asset ${engine.policy().bond.bondAssetStatus}`);
console.log(`  production bond asset ${productionBondPolicy().bondAssetStatus}`);
console.log(`  simulation ${report.scenarios.length}/${report.scenarios.length} passed`);
console.log(`  guaranteedEconomicSecurity ${report.guaranteedEconomicSecurity}`);
