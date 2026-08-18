import { rehearseProtocolTreasury } from './rehearsal.ts';
import { TreasuryScenarioSimulator } from './simulator.ts';
import { verifyTreasury } from './auditor.ts';

const rehearsal = rehearseProtocolTreasury();
const verify = verifyTreasury();
const simulation = new TreasuryScenarioSimulator().run('NORMAL_PROTOCOL_OPERATIONS');
if (!rehearsal.reconciliation || !verify.ok || !simulation.ok) {
  throw new Error('protocol treasury demo failed');
}
console.log(
  JSON.stringify(
    {
      rehearsal,
      verify: { ok: verify.ok, propertiesHold: verify.propertiesHold, stressHold: verify.stressHold },
      simulation: { scenario: simulation.scenario, ok: simulation.ok },
    },
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    2,
  ),
);
