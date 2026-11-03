import type { UtcInstant } from '../../../domain/src/time.ts';
import type { StrategyGenomeId, StrategyGenomeVersion, STRATEGY_GENOME_SCHEMA } from './ids.ts';

export const STRATEGY_NODE_KINDS = [
  'FEATURE',
  'CONDITION',
  'SIGNAL',
  'SIZING',
  'RISK',
  'EXIT',
  'EXECUTION',
  'REGIME_GATE',
  'FLOW',
] as const;

export type StrategyNodeKind = (typeof STRATEGY_NODE_KINDS)[number];

/** Declarative parameter bag — string, number, or boolean only; no embedded code. */
export type GenomeParamValue = string | number | boolean;

export type GenomeNodeParams = Readonly<Record<string, GenomeParamValue>>;

export type StrategyNodeBase = {
  readonly nodeId: string;
  readonly label?: string;
};

export type FeatureNode = StrategyNodeBase & {
  readonly kind: 'FEATURE';
  readonly catalogRef: string;
  readonly params: GenomeNodeParams;
  readonly outputRef: string;
};

export type ConditionNode = StrategyNodeBase & {
  readonly kind: 'CONDITION';
  readonly catalogRef: string;
  readonly inputRef: string;
  readonly comparator: 'LT' | 'LTE' | 'GT' | 'GTE' | 'EQ';
  readonly thresholdParam: string;
  readonly params: GenomeNodeParams;
};

export type SignalNode = StrategyNodeBase & {
  readonly kind: 'SIGNAL';
  readonly catalogRef: string;
  readonly inputRef: string;
  readonly comparator: 'LT' | 'LTE' | 'GT' | 'GTE' | 'EQ';
  readonly thresholdParam: string;
  readonly params: GenomeNodeParams;
  readonly direction: 'LONG' | 'SHORT' | 'FLAT';
};

export type SizingNode = StrategyNodeBase & {
  readonly kind: 'SIZING';
  readonly catalogRef: string;
  readonly signalInputRef: string;
  readonly volFeatureRef: string;
  readonly params: GenomeNodeParams;
};

export type RiskConstraintNode = StrategyNodeBase & {
  readonly kind: 'RISK';
  readonly catalogRef: string;
  readonly sizingInputRef: string;
  readonly params: GenomeNodeParams;
};

export type ExitNode = StrategyNodeBase & {
  readonly kind: 'EXIT';
  readonly catalogRef: string;
  readonly signalInputRef: string;
  readonly params: GenomeNodeParams;
};

export type ExecutionPreferenceNode = StrategyNodeBase & {
  readonly kind: 'EXECUTION';
  readonly catalogRef: string;
  readonly params: GenomeNodeParams;
};

export type RegimeGateNode = StrategyNodeBase & {
  readonly kind: 'REGIME_GATE';
  readonly catalogRef: string;
  readonly permittedRegimes: readonly string[];
  readonly prohibitedRegimes: readonly string[];
  readonly params: GenomeNodeParams;
};

export type FlowNode = StrategyNodeBase & {
  readonly kind: 'FLOW';
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly port?: string;
};

export type StrategyNode =
  | FeatureNode
  | ConditionNode
  | SignalNode
  | SizingNode
  | RiskConstraintNode
  | ExitNode
  | ExecutionPreferenceNode
  | RegimeGateNode
  | FlowNode;

export type StrategyGenomeLineage = {
  readonly parentGenomeIds: readonly StrategyGenomeId[];
  readonly mutationReason: string | null;
  readonly createdBy: string;
  readonly createdAt: UtcInstant;
  readonly featureManifestVersion: string;
  readonly nodeCatalogVersion: string;
  readonly genomeHash: string;
};

export type StrategyGenome = {
  readonly schema: typeof STRATEGY_GENOME_SCHEMA;
  readonly genomeId: StrategyGenomeId;
  readonly version: StrategyGenomeVersion;
  readonly name: string;
  readonly hypothesis: string;
  readonly nodes: readonly StrategyNode[];
  readonly parameters: GenomeNodeParams;
  readonly lineage: StrategyGenomeLineage;
};

export type StrategyGenomeVersionRecord = {
  readonly genomeId: StrategyGenomeId;
  readonly version: StrategyGenomeVersion;
  readonly genomeHash: string;
  readonly parentVersion: StrategyGenomeVersion | null;
  readonly lineage: StrategyGenomeLineage;
};

export type StrategyGenomeFailureCode =
  | 'ARBITRARY_CODE_FORBIDDEN'
  | 'UNKNOWN_CATALOG_REF'
  | 'INVALID_NODE_KIND'
  | 'INVALID_PARAMS'
  | 'DUPLICATE_NODE_ID'
  | 'FLOW_REFERENCE_UNKNOWN'
  | 'GRAPH_CYCLE'
  | 'MISSING_REQUIRED_NODE'
  | 'UNREACHABLE_NODE'
  | 'LIVE_EXECUTION_FORBIDDEN';

export type StrategyGenomeFailure = {
  readonly code: StrategyGenomeFailureCode;
  readonly message: string;
};
