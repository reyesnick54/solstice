/**
 * Chunk 75 dual-economy types.
 *
 * SunRey Coin = human economic layer (simulation).
 * MoonRey Coin = autonomous productive economy layer (simulation).
 *
 * This laboratory does not predict token prices, promise investment
 * returns, or activate production monetary policy. Supplies are never
 * merged. There is no protocol peg of the form 1 SunRey = N MoonRey.
 */

import type {
  ActorClass,
  BridgeFlowKind,
  HumanActivityChannel,
  ProductiveSimCategory,
  ReadinessTrack,
  ScenarioId,
  StabilitySignal,
} from './ids.ts';
import {
  BRIDGE_POLICY_VERSION,
  DUAL_ECONOMY_POLICY_CLASS,
  DUAL_ECONOMY_SCHEMA_VERSION,
  FEE_POLICY_VERSION,
  MOONREY_PRODUCTIVE_POLICY_VERSION,
  SIMULATION_LABEL,
  SUNREY_MONETARY_POLICY_VERSION,
  VALIDATOR_ECONOMICS_VERSION,
} from './ids.ts';

export type DualEconomyScenario = {
  readonly schemaVersion: typeof DUAL_ECONOMY_SCHEMA_VERSION;
  readonly scenarioId: ScenarioId | string;
  readonly title: string;
  readonly parameterClass: typeof DUAL_ECONOMY_POLICY_CLASS;
  readonly simulationLabel: typeof SIMULATION_LABEL;
  readonly seed: number;
  readonly epochs: number;
  readonly epochDurationLabel: 'ABSTRACT_EPOCH';
  readonly human: HumanScenarioParams;
  readonly automation: AutomationScenarioParams;
  readonly productive: ProductiveScenarioParams;
  readonly oracle: OracleScenarioParams;
  readonly market: MarketScenarioParams;
  readonly fees: FeeScenarioParams;
  readonly validators: ValidatorScenarioParams;
  readonly concentration: ConcentrationScenarioParams;
  readonly policies: PolicyExperimentParams;
  readonly assumptions: readonly string[];
};

export type HumanScenarioParams = {
  readonly participants: number;
  readonly demandScale: bigint;
  readonly laborShareBps: bigint;
  readonly informationRightIntensityBps: bigint;
  readonly creativeIntensityBps: bigint;
  readonly entrepreneurialIntensityBps: bigint;
  readonly communityIntensityBps: bigint;
  readonly governedDistributionBps: bigint;
};

export type AutomationScenarioParams = {
  readonly penetrationBps: bigint;
  readonly aiProductivityBps: bigint;
  readonly robotDeploymentBps: bigint;
  readonly productiveSystemCount: number;
};

export type ProductiveScenarioParams = {
  readonly energyAvailabilityBps: bigint;
  readonly computeAvailabilityBps: bigint;
  readonly manufacturingCapacityBps: bigint;
  readonly logisticsCapacityBps: bigint;
  readonly categoryWeightsBps: Readonly<Partial<Record<ProductiveSimCategory, bigint>>>;
};

export type OracleScenarioParams = {
  readonly providerCount: number;
  readonly stale: boolean;
  readonly conflict: boolean;
  readonly removeProviders: number;
};

export type MarketScenarioParams = {
  readonly volatilityBps: bigint;
  readonly makerSpreadBps: bigint;
  readonly startingPriceUnits: bigint;
  readonly orderSize: bigint;
  readonly makerInventorySunrey: bigint;
  readonly makerInventoryMoonrey: bigint;
};

export type FeeScenarioParams = {
  readonly utilizationBps: bigint;
  readonly txPerEpoch: number;
  readonly transferAmount: bigint;
};

export type ValidatorScenarioParams = {
  readonly count: number;
  readonly unavailable: readonly string[];
  readonly penaltyValidatorId: string | null;
  readonly penaltyBps: bigint;
  readonly feeRevenueMode: 'low' | 'normal' | 'high';
};

export type ConcentrationScenarioParams = {
  readonly operatorCount: number;
  readonly dominantShareBps: bigint;
};

export type PolicyExperimentParams = {
  readonly sunreyIssuanceScaleBps: bigint;
  readonly moonreyEpochCapScaleBps: bigint;
  readonly feeMaxUnits: bigint;
  readonly validatorRewardBpsOverride: bigint | null;
  readonly productiveNormalizationBps: bigint;
  readonly becomesProductionPolicy: false;
};

export type HumanEconomyState = {
  readonly participants: number;
  readonly laborShareBps: bigint;
  readonly channels: Readonly<Record<HumanActivityChannel, bigint>>;
  readonly demand: Readonly<Record<ProductiveSimCategory, bigint>>;
  readonly totalActivity: bigint;
  readonly participationIndex: bigint;
};

export type ProductiveEconomyState = {
  readonly systemCount: number;
  readonly availability: Readonly<Record<ProductiveSimCategory, bigint>>;
  readonly output: Readonly<Record<ProductiveSimCategory, bigint>>;
  readonly utilized: Readonly<Record<ProductiveSimCategory, bigint>>;
  readonly totalOutput: bigint;
  readonly outputIndex: bigint;
  readonly coverageVsIssuanceBps: bigint;
};

export type DualAssetEconomicState = {
  readonly sunrey: AssetSupplySlice;
  readonly moonrey: AssetSupplySlice;
  readonly suppliesMerged: false;
  readonly fixedExchangeRate: null;
};

export type AssetSupplySlice = {
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly genesis: bigint;
  readonly issued: bigint;
  readonly circulating: bigint;
  readonly locked: bigint;
  readonly burned: bigint;
  readonly holdings: bigint;
  readonly velocity: bigint;
};

export type EconomicBridgePolicy = {
  readonly policyVersion: typeof BRIDGE_POLICY_VERSION;
  readonly parameterClass: typeof DUAL_ECONOMY_POLICY_CLASS;
  readonly algorithmicPeg: false;
  readonly permittedFlows: readonly BridgeFlowKind[];
  readonly notes: readonly string[];
};

export type EconomicFlow = {
  readonly epoch: number;
  readonly kind: BridgeFlowKind;
  readonly fromLayer: 'HUMAN' | 'PRODUCTIVE' | 'EXCHANGE';
  readonly toLayer: 'HUMAN' | 'PRODUCTIVE' | 'EXCHANGE';
  readonly sunreyAmount: bigint;
  readonly moonreyAmount: bigint;
  readonly activityUnits: bigint;
  readonly note: string;
};

export type DualEconomyMarketState = {
  readonly marketId: typeof import('./ids.ts').EXCHANGE_MARKET_ID;
  readonly lastPriceUnits: bigint | null;
  readonly bestBid: bigint | null;
  readonly bestAsk: bigint | null;
  readonly spreadBps: bigint | null;
  readonly bidDepth: bigint;
  readonly askDepth: bigint;
  readonly volumeBase: bigint;
  readonly volumeQuote: bigint;
  readonly turnover: bigint;
  readonly priceImpactBps: bigint | null;
  readonly trades: number;
  readonly priceDiscovery: 'SIMULATION_ORDER_FLOW_ONLY';
  readonly sunreyLiquidity: bigint;
  readonly moonreyLiquidity: bigint;
};

export type AutomationTransitionModel = {
  readonly penetrationBps: bigint;
  readonly aiProductivityBps: bigint;
  readonly robotDeploymentBps: bigint;
  readonly humanLaborShareBps: bigint;
  readonly intensityIndex: bigint;
};

export type DualEconomyStabilityReport = {
  readonly signals: readonly StabilitySignal[];
  readonly primary: StabilitySignal;
  readonly notes: readonly string[];
  readonly engineeringClassification: true;
  readonly priceForecast: false;
};

export type EconomicConcentrationReport = {
  readonly sunreyHolderHhi: bigint;
  readonly moonreyHolderHhi: bigint;
  readonly productiveOutputHhi: bigint;
  readonly validatorHhi: bigint;
  readonly oracleHhi: bigint;
  readonly exchangeLiquidityHhi: bigint;
  readonly machineOperatorHhi: bigint;
  readonly warnings: readonly string[];
};

export type DualEconomyBalanceReport = {
  readonly humanDemand: bigint;
  readonly humanParticipation: bigint;
  readonly autonomousOutput: bigint;
  readonly sunreyFlow: bigint;
  readonly moonreyFlow: bigint;
  readonly crossEconomyTrade: bigint;
  readonly liquidity: bigint;
  readonly humanToAutonomousActivityBps: bigint;
  readonly demandToOutputBps: bigint;
  readonly sunreyToMoonreyFlowBps: bigint;
  readonly diagnosticOnly: true;
};

export type ScenarioComparisonReport = {
  readonly schemaVersion: typeof DUAL_ECONOMY_SCHEMA_VERSION;
  readonly simulationLabel: typeof SIMULATION_LABEL;
  readonly leftId: string;
  readonly rightId: string;
  readonly seeds: readonly number[];
  readonly deltas: Readonly<Record<string, string>>;
  readonly notes: readonly string[];
  readonly notAForecast: true;
};

export type DualEconomySimulationReport = {
  readonly schemaVersion: typeof DUAL_ECONOMY_SCHEMA_VERSION;
  readonly toolVersion: string;
  readonly simulationLabel: typeof SIMULATION_LABEL;
  readonly scenario: DualEconomyScenario;
  readonly seed: number;
  readonly policyVersions: {
    readonly sunreyMonetary: typeof SUNREY_MONETARY_POLICY_VERSION;
    readonly moonreyProductive: typeof MOONREY_PRODUCTIVE_POLICY_VERSION;
    readonly fees: typeof FEE_POLICY_VERSION;
    readonly validators: typeof VALIDATOR_ECONOMICS_VERSION;
    readonly bridge: typeof BRIDGE_POLICY_VERSION;
  };
  readonly epochs: number;
  readonly sunrey: AssetSupplySlice;
  readonly moonrey: AssetSupplySlice;
  readonly human: HumanEconomyState;
  readonly productive: ProductiveEconomyState;
  readonly automation: AutomationTransitionModel;
  readonly market: DualEconomyMarketState;
  readonly fees: FeeEconomicsSnapshot;
  readonly validators: ValidatorEconomicsSnapshot;
  readonly oracle: OracleHealthSnapshot;
  readonly concentration: EconomicConcentrationReport;
  readonly balance: DualEconomyBalanceReport;
  readonly stability: DualEconomyStabilityReport;
  readonly bridge: EconomicBridgeAnalysis;
  readonly machine: MachineCommerceSnapshot;
  readonly properties: PropertyCheckSnapshot;
  readonly assumptions: readonly string[];
  readonly productionActivation: {
    readonly moonreyIssuanceActivated: false;
    readonly environment: 'simulation';
    readonly liveFlags: false;
    readonly becomesProductionPolicy: false;
  };
  readonly forbiddenLabelsPresent: false;
  readonly epochTrace: readonly EpochSnapshot[];
};

export type EpochSnapshot = {
  readonly epoch: number;
  readonly humanActivity: bigint;
  readonly productiveOutput: bigint;
  readonly sunreyCirculating: bigint;
  readonly moonreyCirculating: bigint;
  readonly lastPriceUnits: bigint | null;
  readonly feeCharged: bigint;
  readonly moonreyIssuedThisEpoch: bigint;
  readonly utilizationBps: bigint;
};

export type FeeEconomicsSnapshot = {
  readonly policyVersion: typeof FEE_POLICY_VERSION;
  readonly charged: bigint;
  readonly burned: bigint;
  readonly validatorRewardPool: bigint;
  readonly networkSink: bigint;
  readonly treasury: bigint;
  readonly utilizationBps: bigint;
  readonly includedTx: number;
  readonly skippedForLimits: number;
  readonly conserved: boolean;
};

export type ValidatorEconomicsSnapshot = {
  readonly policyVersion: typeof VALIDATOR_ECONOMICS_VERSION;
  readonly activeCount: number;
  readonly unavailable: readonly string[];
  readonly rewards: Readonly<Record<string, bigint>>;
  readonly penalizedUnits: bigint;
  readonly feeRevenue: bigint;
  readonly accountingReconciled: boolean;
};

export type OracleHealthSnapshot = {
  readonly providers: number;
  readonly usableFacts: number;
  readonly staleFacts: number;
  readonly conflictedFacts: number;
  readonly rejectedClaims: number;
  readonly failClosed: boolean;
};

export type EconomicBridgeAnalysis = {
  readonly policy: EconomicBridgePolicy;
  readonly flows: readonly EconomicFlow[];
  readonly sunreyAcrossBridge: bigint;
  readonly moonreyAcrossBridge: bigint;
  readonly activityAcrossBridge: bigint;
  readonly intrinsicExchangeRatio: null;
  readonly notes: readonly string[];
};

export type MachineCommerceSnapshot = {
  readonly settled: number;
  readonly rejectedMandate: number;
  readonly sunreySettled: bigint;
  readonly moonreySettled: bigint;
  readonly mandateBypass: false;
};

export type PropertyCheckSnapshot = {
  readonly sunreySupplyReconciles: boolean;
  readonly moonreySupplyReconciles: boolean;
  readonly exchangeDvpConserves: boolean;
  readonly feeConserves: boolean;
  readonly validatorEconomicsReconciles: boolean;
  readonly noDuplicateMoonreyIssuance: boolean;
  readonly noMachineMandateBypass: boolean;
};

export type DualEconomyReadinessEvidence = {
  readonly dimension: 'DUAL_ECONOMY_MODELING';
  readonly tracks: Readonly<Record<ReadinessTrack, 'ENGINEERING_VERIFIED' | 'NOT_PROVIDED'>>;
  readonly productionAuthorization: false;
  readonly notes: readonly string[];
};

export type MonteCarloBatch = {
  readonly baseScenarioId: string;
  readonly seeds: readonly number[];
  readonly reports: readonly DualEconomySimulationReport[];
  readonly notAFinancialPrediction: true;
};

export type AiAnalysisMemo = {
  readonly reportScenarioId: string;
  readonly seed: number;
  readonly explanation: string;
  readonly riskSummary: readonly string[];
  readonly policyProposals: readonly string[];
  readonly canAlterActiveProtocolPolicy: false;
};
