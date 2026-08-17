import { runEconomicsCommand } from './cli.ts';
import { requiredScenarios } from './simulator.ts';

const policy = runEconomicsCommand(['policy', 'verify']);
const supply = runEconomicsCommand(['supply', 'verify']);
const scenarios = requiredScenarios();
console.log(
  JSON.stringify(
    {
      policy: policy.ok,
      supply: supply.ok,
      classification: 'ENGINEERING_SIMULATION',
      scenarios: Object.fromEntries(Object.entries(scenarios).map(([name, row]) => [name, row.ok])),
    },
    null,
    2,
  ),
);
