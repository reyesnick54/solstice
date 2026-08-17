/**
 * npm run demo:sunrey-dual-economy
 *
 * Runs baseline, rapid automation, and energy scarcity, then prints a
 * concise SIMULATION comparison.
 */

import { compareReports } from './compare.ts';
import { renderDashboard } from './dashboard.ts';
import { simulateScenario } from './engine.ts';

const baseline = simulateScenario('baseline', { epochs: 4 });
const rapid = simulateScenario('rapid-automation', { epochs: 4 });
const energy = simulateScenario('energy-scarcity', { epochs: 4 });

console.log(renderDashboard(baseline));
console.log('');
console.log(renderDashboard(rapid));
console.log('');
console.log(renderDashboard(energy));
console.log('');
console.log('=== SIMULATION comparison: baseline vs rapid-automation ===');
console.log(JSON.stringify(compareReports(baseline, rapid), (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2));
console.log('=== SIMULATION comparison: baseline vs energy-scarcity ===');
console.log(JSON.stringify(compareReports(baseline, energy), (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2));
console.log('productionActivation=false moonreyIssuanceActivated=false');
