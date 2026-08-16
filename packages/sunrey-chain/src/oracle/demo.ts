import { runComputeDemo, runEnergyDemo, mutableClock } from './demo-helpers.ts';

const clock = mutableClock();
console.log('SunRey sovereign oracle network demo');
console.log('ENVIRONMENT=simulation  consensus does not call external APIs');

const energy = runEnergyDemo(clock);
console.log('energy_fact_ids', energy.facts.join(','));
console.log('energy_values', energy.values.join(','));
console.log('four_validator_agree', energy.facts.every((id) => id === energy.facts[0]));
console.log('median_mwh', energy.values[0]);
console.log('stale_for_new_use', energy.stale);
console.log('conflicted_divergent_window', energy.conflicted);

const computeClock = mutableClock(1_700_200_000n);
const compute = runComputeDemo(computeClock);
console.log('compute_fact_id', compute.factId);
console.log('compute_gpu_s', compute.value);
console.log('compute_four_validator_agree', compute.snapshots.every((hash) => hash === compute.snapshots[0]));
console.log('demo ok — protocol facts only; not money; not MoonRey issuance');
