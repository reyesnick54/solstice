import type { UtcInstant } from '@solstice/domain';
import type {
  BYTEX_STRATEGY_DOCUMENT_SCHEMA_VERSION,
  NATIVE06_STRATEGY_GENOME_SCHEMA,
  Native06StrategyGenomeId,
  Native06StrategyGenomeVersion,
} from './ids.ts';

export const NATIVE06_NODE_KINDS = [
  'DATA',
  'FEATURE',
  'INDICATOR',
  'CONDITION',
  'SIGNAL',
  'SIZING',
  'RISK',
  'ENTRY',
  'EXIT',
  'EXECUTION_PREFERENCE',
  'REGIME',
  'FLOW',
] as const;

export type Native06NodeKind = (typeof NATIVE06_NODE_KINDS)[number];

export type Native06ParamValue = string | number | boolean;

export type Native06NodeParams = Readonly<Record<string, Native06ParamValue>>;

export type Native06NodeBase = {
  readonly nodeId: string;
  readonly label?: string;
  readonly sourceBytexType?: string;
};

export type DataNode = Native06NodeBase & {
  readonly kind: 'DATA';
  readonly catalogRef: string;
  readonly params: Native06NodeParams;
  readonly outputRef: string;
};

export type FeatureNode = Native06NodeBase & {
  readonly kind: 'FEATURE';
  readonly catalogRef: string;
  readonly params: Native06NodeParams;
  readonly outputRef: string;
};

export type IndicatorNode = Native06NodeBase & {
  readonly kind: 'INDICATOR';
  readonly catalogRef: string;
  readonly inputRef: string;
  readonly params: Native06NodeParams;
  readonly outputRef: string;
};

export type ConditionNode = Native06NodeBase & {
  readonly kind: 'CONDITION';
  readonly catalogRef: string;
  readonly inputRef: string;
  readonly referenceRef?: string;
  readonly comparator?: 'LT' | 'LTE' | 'GT' | 'GTE' | 'EQ';
  readonly thresholdParam?: string;
  readonly params: Native06NodeParams;
};

export type SignalNode = Native06NodeBase & {
  readonly kind: 'SIGNAL';
  readonly catalogRef: string;
  readonly inputRef: string;
  readonly comparator: 'LT' | 'LTE' | 'GT' | 'GTE' | 'EQ';
  readonly thresholdParam: string;
  readonly params: Native06NodeParams;
  readonly direction: 'LONG' | 'SHORT' | 'FLAT';
};

export type SizingNode = Native06NodeBase & {
  readonly kind: 'SIZING';
  readonly catalogRef: string;
  readonly signalInputRef: string;
  readonly volFeatureRef?: string;
  readonly params: Native06NodeParams;
};

export type RiskNode = Native06NodeBase & {
  readonly kind: 'RISK';
  readonly catalogRef: string;
  readonly sizingInputRef: string;
  readonly params: Native06NodeParams;
};

export type EntryNode = Native06NodeBase & {
  readonly kind: 'ENTRY';
  readonly catalogRef: string;
  readonly triggerInputRef: string;
  readonly params: Native06NodeParams;
};

export type ExitNode = Native06NodeBase & {
  readonly kind: 'EXIT';
  readonly catalogRef: string;
  readonly signalInputRef: string;
  readonly params: Native06NodeParams;
};

export type ExecutionPreferenceNode = Native06NodeBase & {
  readonly kind: 'EXECUTION_PREFERENCE';
  readonly catalogRef: string;
  readonly params: Native06NodeParams;
};

export type RegimeNode = Native06NodeBase & {
  readonly kind: 'REGIME';
  readonly catalogRef: string;
  readonly permittedRegimes: readonly string[];
  readonly prohibitedRegimes: readonly string[];
  readonly params: Native06NodeParams;
};

export type FlowNode = Native06NodeBase & {
  readonly kind: 'FLOW';
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly port?: string;
};

export type Native06StrategyNode =
  | DataNode
  | FeatureNode
  | IndicatorNode
  | ConditionNode
  | SignalNode
  | SizingNode
  | RiskNode
  | EntryNode
  | ExitNode
  | ExecutionPreferenceNode
  | RegimeNode
  | FlowNode;

export type Native06StrategyGenomeLineage = {
  readonly parentGenomeIds: readonly Native06StrategyGenomeId[];
  readonly mutationReason: string | null;
  readonly createdBy: string;
  readonly createdAt: UtcInstant;
  readonly featureManifestVersion: string;
  readonly nodeCatalogVersion: string;
  readonly genomeHash: string;
  readonly assimilationSource?: 'BYTEX_STRATEGY_DOCUMENT' | 'HELIOS_NATIVE';
  readonly upstreamDocumentId?: string;
};

export type Native06StrategyGenome = {
  readonly schema: typeof NATIVE06_STRATEGY_GENOME_SCHEMA;
  readonly genomeId: Native06StrategyGenomeId;
  readonly version: Native06StrategyGenomeVersion;
  readonly name: string;
  readonly hypothesis: string;
  readonly nodes: readonly Native06StrategyNode[];
  readonly parameters: Native06NodeParams;
  readonly lineage: Native06StrategyGenomeLineage;
};

export type BytexStrategyDocument = {
  readonly schemaVersion: typeof BYTEX_STRATEGY_DOCUMENT_SCHEMA_VERSION;
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly nodes: readonly {
    readonly id: string;
    readonly type: string;
    readonly params?: Readonly<Record<string, unknown>>;
  }[];
  readonly edges: readonly { readonly from: string; readonly to: string }[];
  readonly parameters?: readonly {
    readonly name: string;
    readonly type: string;
    readonly value: string;
  }[];
};

export type Native06GenomeFailureCode =
  | 'ARBITRARY_CODE_FORBIDDEN'
  | 'UNKNOWN_CATALOG_REF'
  | 'INVALID_NODE_KIND'
  | 'INVALID_PARAMS'
  | 'DUPLICATE_NODE_ID'
  | 'FLOW_REFERENCE_UNKNOWN'
  | 'GRAPH_CYCLE'
  | 'MISSING_REQUIRED_NODE'
  | 'INVALID_BYTEX_DOCUMENT'
  | 'UNSUPPORTED_BYTEX_NODE'
  | 'LIVE_EXECUTION_FORBIDDEN';

export type Native06GenomeFailure = {
  readonly code: Native06GenomeFailureCode;
  readonly message: string;
};
