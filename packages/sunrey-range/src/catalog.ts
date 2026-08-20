import { createRangeEnvironment, type RangeEnvironment } from './environment.ts';
import { apiScenarios, runApi } from './scenarios/api.ts';
import { byzantineScenarios, runByzantine } from './scenarios/byzantine.ts';
import { compoundScenarios, runCompound } from './scenarios/compound.ts';
import { custodyScenarios, runCustody } from './scenarios/custody.ts';
import { exchangeScenarios, runExchange } from './scenarios/exchange.ts';
import { governanceScenarios, runGovernance } from './scenarios/governance.ts';
import { interopScenarios, runInterop } from './scenarios/interop.ts';
import { machineScenarios, runMachine } from './scenarios/machine.ts';
import { moonreyScenarios, runMoonrey } from './scenarios/moonrey.ts';
import { networkScenarios, runNetwork } from './scenarios/network.ts';
import { oracleScenarios, runOracle } from './scenarios/oracle.ts';
import { privacyScenarios, runPrivacy } from './scenarios/privacy.ts';
import { signerScenarios, runSigner } from './scenarios/signer.ts';
import { walletScenarios, runWallet } from './scenarios/wallet.ts';
import { validatorEconomicsScenarios, runValidatorEconomics } from './scenarios/validator-economics.ts';
import { protocolTreasuryScenarios, runProtocolTreasury } from './scenarios/protocol-treasury.ts';
import { economicStressScenarios, runEconomicStress } from './scenarios/economic-stress.ts';
import { auditFindingScenarios, runAuditFinding } from './scenarios/audit-finding.ts';
import { credentialScenarios, runCredential } from './scenarios/credential.ts';
import { endpointScenarios, runEndpoint } from './scenarios/endpoint.ts';
import { oracleAdversarialScenarios, runOracleAdversarial } from './scenarios/oracle-adversarial.ts';
import { productiveAttackScenarios, runProductiveAttack } from './scenarios/productive-attack.ts';
import { humanEconomyScenarios, runHumanEconomy } from './scenarios/human-economy.ts';
import { paymentAttackScenarios, runPaymentAttack } from './scenarios/payment-attack.ts';
import { complianceAttackScenarios, runComplianceAttack } from './scenarios/compliance-attack.ts';
import { travelRuleScenarios, runTravelRule } from './scenarios/travel-rule.ts';
import { custodyAttackScenarios, runCustodyAttack } from './scenarios/custody-attack.ts';
import { persistenceAttackScenarios, runPersistenceAttack } from './scenarios/persistence-attack.ts';
import { eventAttackScenarios, runEventAttack } from './scenarios/event-attack.ts';
import { idempotencyAttackScenarios, runIdempotencyAttack } from './scenarios/idempotency-attack.ts';
import { constitutionAttackScenarios, runConstitutionAttack } from './scenarios/constitution-attack.ts';
import { aiAuthorityScenarios, runAiAuthority } from './scenarios/ai-authority.ts';
import { observabilityAttackScenarios, runObservabilityAttack } from './scenarios/observability-attack.ts';
import { controlRoomScenarios, runControlRoom } from './scenarios/control-room.ts';
import { compoundProductionScenarios, runCompoundProduction } from './scenarios/compound-production.ts';
import type { AttackResult, AttackScenario } from './types.ts';

export const SCENARIO_CATALOG: readonly AttackScenario[] = Object.freeze([
  ...byzantineScenarios,
  ...networkScenarios,
  ...signerScenarios,
  ...walletScenarios,
  ...oracleScenarios,
  ...moonreyScenarios,
  ...machineScenarios,
  ...exchangeScenarios,
  ...privacyScenarios,
  ...custodyScenarios,
  ...governanceScenarios,
  ...interopScenarios,
  ...apiScenarios,
  ...compoundScenarios,
  ...validatorEconomicsScenarios,
  ...protocolTreasuryScenarios,
  ...economicStressScenarios,
  ...auditFindingScenarios,
  ...credentialScenarios,
  ...endpointScenarios,
  ...oracleAdversarialScenarios,
  ...productiveAttackScenarios,
  ...humanEconomyScenarios,
  ...paymentAttackScenarios,
  ...complianceAttackScenarios,
  ...travelRuleScenarios,
  ...custodyAttackScenarios,
  ...persistenceAttackScenarios,
  ...eventAttackScenarios,
  ...idempotencyAttackScenarios,
  ...constitutionAttackScenarios,
  ...aiAuthorityScenarios,
  ...observabilityAttackScenarios,
  ...controlRoomScenarios,
  ...compoundProductionScenarios,
]);

const RUNNERS: Readonly<Record<string, (env: RangeEnvironment, scenario: AttackScenario) => AttackResult>> = {
  BFT: runByzantine,
  NET: runNetwork,
  SIGNER: runSigner,
  WALLET: runWallet,
  MULTISIG: runWallet,
  ORACLE: runOracle,
  MOONREY: runMoonrey,
  GRAPH: runMoonrey,
  MACHINE: runMachine,
  EXCH: runExchange,
  INFO: runPrivacy,
  EXPLORER: runPrivacy,
  CUSTODY: runCustody,
  GOV: runGovernance,
  UPGRADE: runGovernance,
  INTEROP: runInterop,
  BRIDGE: runInterop,
  API: runApi,
  COMPOUND: runCompound,
  VECON: runValidatorEconomics,
  TREASURY: runProtocolTreasury,
  ECON: runEconomicStress,
  AUDIT: runAuditFinding,
  CRED: runCredential,
  ENDPOINT: runEndpoint,
  ORADV: runOracleAdversarial,
  PRODATT: runProductiveAttack,
  HUMAN: runHumanEconomy,
  PAY: runPaymentAttack,
  COMPLY: runComplianceAttack,
  TRAVEL: runTravelRule,
  CUSTADV: runCustodyAttack,
  PERSIST: runPersistenceAttack,
  EVENT: runEventAttack,
  IDEM: runIdempotencyAttack,
  CONST: runConstitutionAttack,
  AIAUTH: runAiAuthority,
  OBS: runObservabilityAttack,
  CTRL: runControlRoom,
  COMPSAFE: runCompoundProduction,
};

export function scenarioById(scenarioId: string): AttackScenario | undefined {
  return SCENARIO_CATALOG.find((row) => row.scenarioId === scenarioId);
}

export function runScenario(env: RangeEnvironment, scenarioId: string): AttackResult {
  const scenario = scenarioById(scenarioId);
  if (!scenario) {
    throw new Error(`unknown scenario ${scenarioId}`);
  }
  const prefix = scenarioId.split('-')[0] ?? '';
  const runner = RUNNERS[prefix];
  if (!runner) {
    throw new Error(`no runner for ${scenarioId}`);
  }
  return runner(env, scenario);
}

export function runScenarioIsolated(scenarioId: string): AttackResult {
  const scenario = scenarioById(scenarioId);
  if (!scenario) {
    throw new Error(`unknown scenario ${scenarioId}`);
  }
  return runScenario(createRangeEnvironment(scenario.seed), scenarioId);
}

export function renderAttackMatrixMarkdown(scenarios: readonly AttackScenario[] = SCENARIO_CATALOG): string {
  const header = [
    '# SunRey adversarial attack matrix',
    '',
    'Engineering test matrix for the isolated Chunk 57 range. Detector output is not legal guilt.',
    '',
    '| scenario | subsystem | attack/fault | preventive control | detective control | invariant | recovery | test status |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  const rows = scenarios.map((row) =>
    `| ${row.scenarioId} | ${row.subsystem} | ${row.attack} | ${row.preventiveControl} | ${row.detectiveControl} | ${row.expectedSecurityProperties.join(', ')} | ${row.recovery} | TESTED |`,
  );
  return [...header, ...rows, ''].join('\n');
}
