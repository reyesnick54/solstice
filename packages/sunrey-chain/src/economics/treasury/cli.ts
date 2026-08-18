/**
 * sunrey-economics treasury commands.
 */

import { verifyTreasury, showTreasuryPolicy } from './auditor.ts';
import { ProtocolTreasuryEngine } from './engine.ts';
import { protocolTreasuryReadinessSummary } from './readiness.ts';
import { TreasuryScenarioSimulator, TREASURY_SCENARIOS, type TreasuryScenarioId } from './simulator.ts';

export type TreasuryCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner)),
  );
}

export function runTreasuryCommand(argv: readonly string[]): TreasuryCliResult {
  const [verb = 'help', scenario] = argv;
  const engine = new ProtocolTreasuryEngine();
  if (verb === 'policy') {
    return { ok: true, command: 'treasury policy', payload: jsonSafe(showTreasuryPolicy()) };
  }
  if (verb === 'reserves') {
    return { ok: true, command: 'treasury reserves', payload: jsonSafe(engine.transparency().reserves) };
  }
  if (verb === 'budgets') {
    return { ok: true, command: 'treasury budgets', payload: jsonSafe(engine.listBudgets()) };
  }
  if (verb === 'disbursements') {
    return { ok: true, command: 'treasury disbursements', payload: jsonSafe(engine.listDisbursements()) };
  }
  if (verb === 'verify') {
    const report = verifyTreasury(engine);
    return { ok: report.ok, command: 'treasury verify', payload: jsonSafe(report) };
  }
  if (verb === 'simulate') {
    const id = TREASURY_SCENARIOS.includes(scenario as TreasuryScenarioId)
      ? (scenario as TreasuryScenarioId)
      : 'NORMAL_PROTOCOL_OPERATIONS';
    const result = new TreasuryScenarioSimulator().run(id);
    return { ok: result.ok, command: 'treasury simulate', payload: jsonSafe(result) };
  }
  if (verb === 'readiness') {
    return { ok: true, command: 'treasury readiness', payload: jsonSafe(protocolTreasuryReadinessSummary()) };
  }
  return {
    ok: true,
    command: 'treasury help',
    payload: {
      usage:
        'sunrey-economics treasury <policy|reserves|budgets|disbursements|verify|simulate|readiness>',
      productionTreasuryInactive: true,
    },
  };
}
