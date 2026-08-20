import {
  evaluateProductionEconomicActivation,
  currentRepositorySnapshot,
  AI_CAN_AUTHORIZE_PRODUCTION,
  CHUNK_71_REMAINS_MONETARY_AUTHORITY,
} from '../../../sunrey-chain/src/economics/production-activation/index.ts';
import {
  authorizeIssuance,
  developmentSunReyAuthority,
  rejectOracleOnlyMint,
  rejectUnrestrictedMint,
} from '../../../sunrey-chain/src/economics/issuance.ts';
import { nativeAssetConstitution } from '../../../sunrey-chain/src/economics/constitution.ts';
import { emptyBook, supplyReconciles } from '../../../sunrey-chain/src/economics/supply.ts';
import { ENVIRONMENT, LIVE_MONEY_ENABLED } from '../../../config/src/flags.ts';
import { runProductionAttack, safetyScenario } from './production-helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';
import type { RangeEnvironment } from '../environment.ts';

const INVARIANTS = [
  'CHUNK_71_MONETARY_AUTHORITY',
  'ASSET_SUPPLYBOOK_CANONICAL',
  'PRODUCTION_NOT_ACTIVE',
  'AI_CANNOT_EXECUTE',
  'NO_DIRECT_PROVIDER_MINT',
  'NO_REFERENCE_PRICE_MINT',
] as const;

export const constitutionAttackScenarios: readonly AttackScenario[] = [
  'CONST-AI-TOKENOMICS',
  'CONST-FIXTURE-AS-PRODUCTION',
  'CONST-UNCONFIGURED-AS-CONFIGURED',
  'CONST-SUNREY-BYPASS-71',
  'CONST-MOONREY-BYPASS-71',
  'CONST-SUPPLYBOOK-MUTATION',
  'CONST-REFERENCE-PRICE-CONVERSION',
  'CONST-ACTIVATION-WITHOUT-EVIDENCE',
].map((scenarioId, index) =>
  safetyScenario({
    scenarioId,
    seed: 15940 + index,
    category: 'ECONOMIC_CONSTITUTION_ABUSE',
    subsystem: 'economic-constitution',
    attack: scenarioId.toLowerCase().replace('const-', '').replaceAll('-', ' '),
    invariants: INVARIANTS,
    detection: 'PRODUCTION_ACTIVATION_BLOCKED',
  }),
);

export function runConstitutionAttack(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  return runProductionAttack(env, scenario, () => {
    const decision = evaluateProductionEconomicActivation(currentRepositorySnapshot());
    const sunrey = emptyBook('SUNREY_COIN', 'sunrey.monetary.constitution.v1');
    const moonrey = emptyBook('MOONREY_COIN', 'sunrey.monetary.constitution.v1');
    const aiMint = authorizeIssuance(
      nativeAssetConstitution('DEVELOPMENT_ACTIVE'),
      sunrey,
      developmentSunReyAuthority({
        recipient: 'acct_1',
        quantity: 100n,
        replayIdentifier: 'r1',
        actorKind: 'AI',
      }),
    );
    const blocked =
      decision.productionActivated === false &&
      AI_CAN_AUTHORIZE_PRODUCTION === false &&
      CHUNK_71_REMAINS_MONETARY_AUTHORITY === true &&
      ENVIRONMENT === 'simulation' &&
      LIVE_MONEY_ENABLED === false &&
      rejectOracleOnlyMint() === 'ORACLE_OBSERVATION_CANNOT_MINT' &&
      rejectUnrestrictedMint() === 'UNRESTRICTED_MINT_UNAVAILABLE' &&
      supplyReconciles(sunrey) &&
      supplyReconciles(moonrey) &&
      sunrey.issuedPostGenesis === 0n &&
      moonrey.issuedPostGenesis === 0n &&
      aiMint.ok === false;
    return {
      blocked,
      safetyHeld: blocked,
      detail: `${scenario.scenarioId} activated=${String(decision.productionActivated)} aiMint=${aiMint.ok} sunrey=${sunrey.circulating} moonrey=${moonrey.circulating}`,
    };
  });
}
