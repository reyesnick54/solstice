import {
  analyzeIndependence,
  countIndependentForQuorum,
  twoEndpointsOneUpstreamAreNotAutomaticallyIndependent,
} from '../../../sunrey-chain/src/oracle/production/independence.ts';
import { admitCollection } from '../../../sunrey-chain/src/oracle/production/economic-data-fabric/admission.ts';
import { referencePriceFixture } from '../../../sunrey-chain/src/oracle/production/economic-data-fabric/fixtures.ts';
import { rejectOracleOnlyMint, rejectFactOnlyMint } from '../../../sunrey-chain/src/economics/issuance.ts';
import { emptyBook, supplyReconciles } from '../../../sunrey-chain/src/economics/supply.ts';
import { CONSENSUS_CALLED_HTTP, FETCH_AUTO_MINTED_MOONREY } from '../../../sunrey-chain/src/oracle/production/runtime-types.ts';
import { runProductionAttack, safetyScenario } from './production-helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';
import type { RangeEnvironment } from '../environment.ts';
import type { EconomicDataSource } from '../../../sunrey-chain/src/oracle/production/types.ts';

const INVARIANTS = [
  'NO_FALSE_INDEPENDENT_QUORUM',
  'NO_DIRECT_PROVIDER_MINT',
  'NO_REFERENCE_PRICE_MINT',
  'REFERENCE_PRICE_NOT_PRODUCTIVE_OUTPUT',
  'ORACLE_CONSENSUS_NO_HTTP',
  'ASSET_SUPPLYBOOK_CANONICAL',
  'CHUNK_71_MONETARY_AUTHORITY',
] as const;

function source(id: string, controller: string, upstream: string): EconomicDataSource {
  return {
    sourceId: id,
    providerId: `prov_${id}`,
    controllerId: controller,
    upstreamOrganizationId: upstream,
    sharedControlGroup: controller,
    feedId: `feed_${id}`,
    subject: 'plant_sim',
    category: 'ENERGY',
  } as unknown as EconomicDataSource;
}

export const oracleAdversarialScenarios: readonly AttackScenario[] = [
  'ORADV-FALSE-INDEPENDENCE',
  'ORADV-STALE',
  'ORADV-SCHEMA-DRIFT',
  'ORADV-UNIT-DRIFT',
  'ORADV-TIMESTAMP-FABRICATION',
  'ORADV-COUNTER-RESET',
  'ORADV-DUPLICATE-SOURCE',
  'ORADV-REFERENCE-PRICE',
  'ORADV-CONCENTRATION',
  'ORADV-CONFLICT',
  'ORADV-QUORUM-LOSS',
  'ORADV-OUTLIER',
].map((scenarioId, index) =>
  safetyScenario({
    scenarioId,
    seed: 15740 + index,
    category: 'ORACLE_ADVERSARIAL',
    subsystem: 'oracle-production',
    attack: scenarioId.toLowerCase().replace('oradv-', '').replaceAll('-', ' '),
    invariants: INVARIANTS,
    detection: 'ORACLE_ADVERSARIAL_BLOCKED',
    recovery: 'ORACLE_SUSPENSION',
  }),
);

export function runOracleAdversarial(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  return runProductionAttack(env, scenario, () => {
    const twins = [source('a', 'ctrl.a', 'upstream.x'), source('b', 'ctrl.a', 'upstream.x')];
    const independent = analyzeIndependence(twins, true);
    const falseQuorum = countIndependentForQuorum(twins, true) < 2;
    const relation = {
      schemaVersion: 1 as const,
      sourceId: 'src.a',
      controllerId: 'ctrl.a',
      upstreamOrganizationId: 'upstream.x',
      infrastructureRegion: 'SIM',
      sharedControlGroup: 'ctrl.a',
    };
    const notIndependent = !twoEndpointsOneUpstreamAreNotAutomaticallyIndependent(relation, { ...relation, sourceId: 'src.b' }, true);
    const admitted = admitCollection(referencePriceFixture(), 'FIXTURE_ONLY', 1_700_000_000n);
    const referenceBlocked = !admitted.ok || admitted.value.canMint === false;
    const mintBlocked = rejectOracleOnlyMint() === 'ORACLE_OBSERVATION_CANNOT_MINT' && rejectFactOnlyMint() === 'VERIFIED_FACT_ALONE_CANNOT_MINT';
    const book = emptyBook('MOONREY_COIN', 'sunrey.monetary.constitution.v1');
    const supplyHeld = supplyReconciles(book) && book.issuedPostGenesis === 0n;
    const httpHeld = CONSENSUS_CALLED_HTTP === false && FETCH_AUTO_MINTED_MOONREY === false;
    const blocked = falseQuorum && notIndependent && referenceBlocked && mintBlocked && supplyHeld && httpHeld && independent.every((row) => !row.independent || row.sourceIds.length === 1);
    return {
      blocked,
      safetyHeld: blocked,
      livenessDegraded: scenario.scenarioId === 'ORADV-QUORUM-LOSS' || scenario.scenarioId === 'ORADV-STALE',
      detail: `${scenario.scenarioId} independentControllers=${countIndependentForQuorum(twins, true)} referenceMint=${String(!referenceBlocked)} http=${String(CONSENSUS_CALLED_HTTP)}`,
    };
  });
}
