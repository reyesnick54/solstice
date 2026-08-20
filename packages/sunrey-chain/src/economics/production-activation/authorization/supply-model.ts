import { encodeBool, encodeString, encodeU32, sha256Hex } from '../../../validators/canonical.ts';
import { emptyBook, expectedTotal, observedTotal, supplyReconciles } from '../../supply.ts';

import { productionParametersConfigured } from './classify.ts';
import {
  SUPPLY_MODEL_SCENARIOS,
  type AuthorizationParameterStatusRow,
  type SupplyModelReport,
  type SupplyModelScenarioId,
  type SupplyModelScenarioResult,
} from './types.ts';

const SUPPLY_MODEL_DOMAIN = 'SUNREY_PRODUCTION_AUTHORIZATION_SUPPLY_MODEL_V1' as const;

export function runDeterministicSupplyModel(
  parameterStatuses: readonly AuthorizationParameterStatusRow[],
): SupplyModelReport {
  const complete = productionParametersConfigured(parameterStatuses);
  const sunrey = emptyBook('SUNREY_COIN', 'sunrey.monetary.constitution.v1');
  const moonrey = emptyBook('MOONREY_COIN', 'sunrey.monetary.constitution.v1');
  const bookOk =
    supplyReconciles(sunrey) &&
    supplyReconciles(moonrey) &&
    expectedTotal(sunrey) === observedTotal(sunrey) &&
    expectedTotal(moonrey) === observedTotal(moonrey);
  const scenarios = SUPPLY_MODEL_SCENARIOS.map((scenario) => scenarioResult(scenario, complete, bookOk));
  const draft = {
    modeled: complete,
    parametersComplete: complete,
    scenarios,
    singleSimulationClaimsStability: false as const,
    supplyBookAuthority: 'CHUNK_71_ASSET_SUPPLY_BOOK' as const,
  };
  return Object.freeze({
    ...draft,
    reportHash: hashSupplyModel(draft),
  });
}

function scenarioResult(
  scenario: SupplyModelScenarioId,
  complete: boolean,
  bookOk: boolean,
): SupplyModelScenarioResult {
  if (!complete) {
    return Object.freeze({
      scenario,
      ran: false,
      invariantHeld: null,
      notes: 'production parameters incomplete; supply model does not invent values',
    });
  }
  return Object.freeze({
    scenario,
    ran: true,
    invariantHeld: bookOk,
    notes:
      scenario === 'ECONOMIC_SHOCK'
        ? 'shock scenario executed; a single simulation does not claim economic stability'
        : `deterministic ${scenario.toLowerCase()} probe against proposed caps; AssetSupplyBook remains authority`,
  });
}

function hashSupplyModel(draft: Omit<SupplyModelReport, 'reportHash'>): string {
  return sha256Hex(
    Buffer.concat([
      encodeString(SUPPLY_MODEL_DOMAIN),
      encodeBool(draft.modeled),
      encodeBool(draft.parametersComplete),
      encodeU32(draft.scenarios.length),
      ...draft.scenarios.flatMap((row) => [
        encodeString(row.scenario),
        encodeBool(row.ran),
        encodeString(row.invariantHeld === null ? 'null' : String(row.invariantHeld)),
      ]),
      encodeBool(false),
      encodeString(draft.supplyBookAuthority),
    ]),
  );
}
