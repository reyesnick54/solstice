/**
 * DualEconomySimulationEngine
 *
 * Deterministic post-automation laboratory. A scenario plus seed
 * reproduces identical results. It does not activate production
 * monetary policy or forecast prices.
 */

import { assertSimulationOnly } from '../../config/src/flags.ts';
import { moonreyIssuanceActivated } from '../../sunrey-chain/src/protocol/assets.ts';
import { DUAL_ECONOMY_TOOL_VERSION, SIMULATION_LABEL } from './ids.ts';
import {
  applyBurnSlice,
  applyIssuanceSlice,
  applyLockSlice,
  dualAssets,
  emptySupply,
  evolveAutomation,
  humanState,
  productiveState,
  supplyReconciles,
  withVelocity,
} from './layers.ts';
import { createMachineLab, machineSnapshot, runMachineEpoch } from './machine.ts';
import { createMarket, holderShares, marketConserves, priceVolatilityBps, runMarketEpoch } from './market.ts';
import { DEFAULT_BRIDGE_POLICY, consumedPolicyVersions, sunreyMonetaryIssuance } from './policies.ts';
import {
  createProtocolLab,
  feeSnapshot,
  issueMoonReyForEpoch,
  moonreySupplyFromEngine,
  oracleSnapshot,
  runFeeEpoch,
  validatorSnapshot,
} from './protocol.ts';
import { assertNoForbiddenLabels, DeterministicRng, herfindahl, ratioBps } from './seed.ts';
import { loadScenario } from './scenarios.ts';
import type {
  DualEconomyBalanceReport,
  DualEconomyScenario,
  DualEconomySimulationReport,
  DualEconomyStabilityReport,
  EconomicBridgeAnalysis,
  EconomicConcentrationReport,
  EconomicFlow,
  EpochSnapshot,
  PropertyCheckSnapshot,
} from './types.ts';
import type { StabilitySignal } from './ids.ts';

export class DualEconomySimulationEngine {
  simulate(scenario: DualEconomyScenario): DualEconomySimulationReport {
    assertSimulationPosture();
    assertNoForbiddenLabels(scenario.title);
    const rng = new DeterministicRng(scenario.seed);
    const protocol = createProtocolLab(scenario);
    const market = createMarket(scenario);
    const machines = createMachineLab();
    let sunrey = emptySupply('SUNREY_COIN', 1_000_000n);
    let moonrey = emptySupply('MOONREY_COIN', 0n);
    const flows: EconomicFlow[] = [];
    const epochs: EpochSnapshot[] = [];
    let lastHuman = humanState(scenario, evolveAutomation(scenario, 0), scenario.fees.utilizationBps);
    let lastProductive = productiveState(scenario, evolveAutomation(scenario, 0), lastHuman, 0n);
    let lastMarket = runMarketEpoch(market, scenario, rng, 0);
    let lastAutomation = evolveAutomation(scenario, 0);

    for (let epoch = 1; epoch <= scenario.epochs; epoch += 1) {
      lastAutomation = evolveAutomation(scenario, epoch);
      const congestion = scenario.fees.utilizationBps;
      lastHuman = humanState(scenario, lastAutomation, congestion);
      lastProductive = productiveState(scenario, lastAutomation, lastHuman, 1n);
      const issuedMoon = issueMoonReyForEpoch(protocol, scenario, lastProductive, epoch);
      lastProductive = productiveState(scenario, lastAutomation, lastHuman, issuedMoon === 0n ? 1n : issuedMoon);
      const issuedSun = sunreyMonetaryIssuance({ scenario, epoch, humanActivity: lastHuman.totalActivity });
      const authorizedSun = protocol.stack.issueSunRey('household', issuedSun, `dual-sunrey-${epoch}`);
      sunrey = applyIssuanceSlice(sunrey, authorizedSun.ok ? authorizedSun.quantity : 0n);
      const nativeMoon = moonreySupplyFromEngine(protocol);
      moonrey = Object.freeze({
        ...moonrey,
        issued: nativeMoon.issued,
        burned: nativeMoon.burned,
        locked: nativeMoon.locked,
        holdings: nativeMoon.holdings,
        circulating: nativeMoon.holdings - nativeMoon.locked,
        genesis: 0n,
      });
      lastMarket = runMarketEpoch(market, scenario, rng, epoch);
      runFeeEpoch(protocol, scenario, epoch);
      runMachineEpoch(machines, epoch, false);
      const feeBurn = feeSnapshot(protocol, congestion).burned - (epochs.at(-1) ? 0n : 0n);
      if (epoch === scenario.epochs && feeSnapshot(protocol, congestion).burned > 0n) {
        const incrementalBurn = feeSnapshot(protocol, congestion).burned > sunrey.circulating ? 0n : 0n;
        void incrementalBurn;
        void feeBurn;
      }
      const bridgeSun = lastHuman.channels.productiveServiceUse / 100n;
      const bridgeMoon = lastProductive.totalOutput / 200n;
      sunrey = applyLockSlice(sunrey, 0n);
      flows.push(
        Object.freeze({
          epoch,
          kind: 'HUMAN_DEMAND_PURCHASE',
          fromLayer: 'HUMAN',
          toLayer: 'PRODUCTIVE',
          sunreyAmount: bridgeSun,
          moonreyAmount: 0n,
          activityUnits: lastHuman.demand.COMPUTE + lastHuman.demand.ENERGY + lastHuman.demand.SERVICES,
          note: 'Synthetic human demand for automated products/services',
        }),
        Object.freeze({
          epoch,
          kind: 'MACHINE_COMMERCE',
          fromLayer: 'PRODUCTIVE',
          toLayer: 'PRODUCTIVE',
          sunreyAmount: 0n,
          moonreyAmount: machines.moonreySettled,
          activityUnits: BigInt(machines.settled),
          note: 'Mandate-bound machine-to-machine settlement',
        }),
        Object.freeze({
          epoch,
          kind: 'EXCHANGE_CONVERSION',
          fromLayer: 'EXCHANGE',
          toLayer: 'EXCHANGE',
          sunreyAmount: lastMarket.volumeBase,
          moonreyAmount: lastMarket.volumeQuote,
          activityUnits: BigInt(lastMarket.trades),
          note: 'SUNREY_COIN/MOONREY_COIN order-flow conversion; not a peg',
        }),
        Object.freeze({
          epoch,
          kind: 'HUMAN_INFORMATION_RIGHT',
          fromLayer: 'HUMAN',
          toLayer: 'PRODUCTIVE',
          sunreyAmount: lastHuman.channels.informationRights / 50n,
          moonreyAmount: 0n,
          activityUnits: lastHuman.channels.informationRights,
          note: 'Human information-right computation demand',
        }),
        Object.freeze({
          epoch,
          kind: 'COMPUTE_CONSUMPTION',
          fromLayer: 'HUMAN',
          toLayer: 'PRODUCTIVE',
          sunreyAmount: lastHuman.demand.COMPUTE / 100n,
          moonreyAmount: lastProductive.output.COMPUTE / 100n,
          activityUnits: lastProductive.utilized.COMPUTE,
          note: 'Compute consumption across the economic bridge',
        }),
        Object.freeze({
          epoch,
          kind: 'PRODUCTIVE_CAPACITY_CONTRACT',
          fromLayer: 'PRODUCTIVE',
          toLayer: 'HUMAN',
          sunreyAmount: 0n,
          moonreyAmount: issuedMoon / 4n,
          activityUnits: lastProductive.totalOutput,
          note: 'Productive capacity contracted into the human layer',
        }),
      );
      const sunreyFlow = issuedSun + lastMarket.volumeBase + bridgeSun;
      const moonreyFlow = issuedMoon + lastMarket.volumeQuote + bridgeMoon;
      sunrey = withVelocity(sunrey, sunreyFlow);
      moonrey = withVelocity(moonrey, moonreyFlow);
      epochs.push(
        Object.freeze({
          epoch,
          humanActivity: lastHuman.totalActivity,
          productiveOutput: lastProductive.totalOutput,
          sunreyCirculating: sunrey.circulating,
          moonreyCirculating: moonrey.circulating,
          lastPriceUnits: lastMarket.lastPriceUnits,
          feeCharged: feeSnapshot(protocol, congestion).charged,
          moonreyIssuedThisEpoch: issuedMoon,
          utilizationBps: congestion,
        }),
      );
    }

    if (scenario.fees.utilizationBps > 8_000n && sunrey.circulating > 10n) {
      sunrey = applyBurnSlice(sunrey, 1n);
    }

    const fees = feeSnapshot(protocol, scenario.fees.utilizationBps);
    const validators = validatorSnapshot(protocol, scenario);
    const oracle = oracleSnapshot(protocol, scenario);
    const machine = machineSnapshot(machines);
    const assets = dualAssets(sunrey, moonrey);
    const concentration = concentrationReport(scenario, market, validators, lastProductive, oracle);
    const balance = balanceReport(lastHuman, lastProductive, assets.sunrey, assets.moonrey, lastMarket, flows);
    const stability = stabilityReport(scenario, lastMarket, concentration, oracle, fees, balance, lastProductive);
    const properties: PropertyCheckSnapshot = Object.freeze({
      sunreySupplyReconciles: supplyReconciles(sunrey) && protocol.stack.reconcile().sunreyReconciles,
      moonreySupplyReconciles: supplyReconciles(moonrey) && protocol.stack.reconcile().moonreyReconciles,
      exchangeDvpConserves: marketConserves(market),
      feeConserves: fees.conserved && protocol.stack.reconcile().feeDispositionReconciles,
      validatorEconomicsReconciles: validators.accountingReconciled,
      noDuplicateMoonreyIssuance: protocol.issuedFingerprints.size === protocol.stack.productive.snapshot().receipts.length,
      noMachineMandateBypass: machine.mandateBypass === false,
    });
    const bridge = bridgeAnalysis(flows);
    const report: DualEconomySimulationReport = Object.freeze({
      schemaVersion: 1,
      toolVersion: DUAL_ECONOMY_TOOL_VERSION,
      simulationLabel: SIMULATION_LABEL,
      scenario,
      seed: scenario.seed,
      policyVersions: consumedPolicyVersions(),
      epochs: scenario.epochs,
      sunrey,
      moonrey,
      human: lastHuman,
      productive: lastProductive,
      automation: lastAutomation,
      market: lastMarket,
      fees,
      validators,
      oracle,
      concentration,
      balance,
      stability,
      bridge,
      machine,
      properties,
      assumptions: scenario.assumptions,
      productionActivation: Object.freeze({
        moonreyIssuanceActivated: false,
        environment: 'simulation',
        liveFlags: false,
        becomesProductionPolicy: false,
      }),
      forbiddenLabelsPresent: false,
      epochTrace: Object.freeze(epochs),
    });
    assertNoForbiddenLabels(JSON.stringify(report.stability));
    void priceVolatilityBps(market);
    return report;
  }
}

export function simulateScenario(id: string, overrides?: Partial<Pick<DualEconomyScenario, 'seed' | 'epochs'>>): DualEconomySimulationReport {
  return new DualEconomySimulationEngine().simulate(loadScenario(id, overrides));
}

function assertSimulationPosture(): void {
  assertSimulationOnly();
  if (moonreyIssuanceActivated()) {
    throw new Error('dual-economy lab refuses production MoonRey issuance');
  }
}

function concentrationReport(
  scenario: DualEconomyScenario,
  market: ReturnType<typeof createMarket>,
  validators: DualEconomySimulationReport['validators'],
  productive: DualEconomySimulationReport['productive'],
  oracle: DualEconomySimulationReport['oracle'],
): EconomicConcentrationReport {
  const operators = Math.max(1, scenario.concentration.operatorCount);
  const shares: bigint[] = [];
  let remaining = 10_000n;
  for (let index = 0; index < operators; index += 1) {
    const share = index === 0 ? scenario.concentration.dominantShareBps : remaining / BigInt(Math.max(1, operators - index));
    const clipped = share > remaining ? remaining : share;
    shares.push(clipped);
    remaining -= clipped;
  }
  const warnings: string[] = [];
  const productiveHhi = herfindahl(shares);
  if (productiveHhi > 2_500_0000n || scenario.concentration.dominantShareBps >= 5_000n) {
    warnings.push('PRODUCTIVE_CONCENTRATION: few operators dominate energy/compute/AI/manufacturing');
  }
  if (oracle.providers < 3) {
    warnings.push('ORACLE_DEPENDENCY: usable oracle providers below fail-closed quorum');
  }
  return Object.freeze({
    sunreyHolderHhi: herfindahl(holderShares(market.balances.sunrey)),
    moonreyHolderHhi: herfindahl(holderShares(market.balances.moonrey)),
    productiveOutputHhi: productiveHhi,
    validatorHhi: herfindahl(Object.values(validators.rewards)),
    oracleHhi: herfindahl(Array.from({ length: Math.max(1, oracle.providers) }, () => 1n)),
    exchangeLiquidityHhi: herfindahl(holderShares(market.balances.moonrey)),
    machineOperatorHhi: herfindahl(shares),
    warnings: Object.freeze(warnings),
  });
}

function balanceReport(
  human: DualEconomySimulationReport['human'],
  productive: DualEconomySimulationReport['productive'],
  sunrey: DualEconomySimulationReport['sunrey'],
  moonrey: DualEconomySimulationReport['moonrey'],
  market: DualEconomySimulationReport['market'],
  flows: readonly EconomicFlow[],
): DualEconomyBalanceReport {
  const sunreyFlow = flows.reduce((sum, flow) => sum + flow.sunreyAmount, 0n);
  const moonreyFlow = flows.reduce((sum, flow) => sum + flow.moonreyAmount, 0n);
  const trade = flows.filter((flow) => flow.kind === 'EXCHANGE_CONVERSION' || flow.kind === 'HUMAN_DEMAND_PURCHASE').reduce((sum, flow) => sum + flow.activityUnits, 0n);
  return Object.freeze({
    humanDemand: Object.values(human.demand).reduce((sum, value) => sum + value, 0n),
    humanParticipation: human.totalActivity,
    autonomousOutput: productive.totalOutput,
    sunreyFlow,
    moonreyFlow,
    crossEconomyTrade: trade,
    liquidity: market.sunreyLiquidity + market.moonreyLiquidity,
    humanToAutonomousActivityBps: ratioBps(human.totalActivity, productive.totalOutput === 0n ? 1n : productive.totalOutput),
    demandToOutputBps: ratioBps(Object.values(human.demand).reduce((sum, value) => sum + value, 0n), productive.totalOutput === 0n ? 1n : productive.totalOutput),
    sunreyToMoonreyFlowBps: ratioBps(sunreyFlow, moonreyFlow === 0n ? 1n : moonreyFlow),
    diagnosticOnly: true,
  });
}

function stabilityReport(
  scenario: DualEconomyScenario,
  market: DualEconomySimulationReport['market'],
  concentration: EconomicConcentrationReport,
  oracle: DualEconomySimulationReport['oracle'],
  fees: DualEconomySimulationReport['fees'],
  balance: DualEconomyBalanceReport,
  productive: DualEconomySimulationReport['productive'],
): DualEconomyStabilityReport {
  const signals: StabilitySignal[] = [];
  if ((market.spreadBps ?? 0n) > 1_000n || market.sunreyLiquidity + market.moonreyLiquidity < scenario.market.orderSize) {
    signals.push('LIQUIDITY_STRESS');
  }
  if (concentration.warnings.some((warning) => warning.startsWith('PRODUCTIVE_CONCENTRATION'))) {
    signals.push('PRODUCTIVE_CONCENTRATION');
  }
  if (concentration.sunreyHolderHhi > 4_000_0000n || concentration.moonreyHolderHhi > 4_000_0000n) {
    signals.push('ISSUANCE_CONCENTRATION');
  }
  if (oracle.failClosed || oracle.providers < 3) {
    signals.push('ORACLE_DEPENDENCY');
  }
  if (fees.utilizationBps >= 8_000n || fees.skippedForLimits > 0) {
    signals.push('FEE_PRESSURE');
  }
  if (balance.demandToOutputBps < 4_000n || balance.demandToOutputBps > 16_000n) {
    signals.push('DEMAND_IMBALANCE');
  }
  if (productive.coverageVsIssuanceBps > 0n && productive.coverageVsIssuanceBps < 2_000n) {
    signals.push('SUPPLY_GROWTH_WARNING');
  }
  if (signals.length === 0) {
    signals.push('HEALTHY_SIMULATION');
  }
  return Object.freeze({
    signals: Object.freeze(signals),
    primary: signals[0] ?? 'HEALTHY_SIMULATION',
    notes: Object.freeze([
      'Signals are engineering classifications for the simulation laboratory.',
      'They are not price forecasts and do not authorize production policy.',
    ]),
    engineeringClassification: true,
    priceForecast: false,
  });
}

function bridgeAnalysis(flows: readonly EconomicFlow[]): EconomicBridgeAnalysis {
  return Object.freeze({
    policy: DEFAULT_BRIDGE_POLICY,
    flows: Object.freeze(flows.slice(-24)),
    sunreyAcrossBridge: flows.reduce((sum, flow) => sum + flow.sunreyAmount, 0n),
    moonreyAcrossBridge: flows.reduce((sum, flow) => sum + flow.moonreyAmount, 0n),
    activityAcrossBridge: flows.reduce((sum, flow) => sum + flow.activityUnits, 0n),
    intrinsicExchangeRatio: null,
    notes: Object.freeze([
      'Value and activity cross through markets, machine services, capacity consumption, and Exchange conversion.',
      'No fixed intrinsic SunRey/MoonRey ratio is claimed.',
    ]),
  });
}
