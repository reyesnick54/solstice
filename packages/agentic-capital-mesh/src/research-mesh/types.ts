import type { UtcInstant } from '../../../domain/src/time.ts';

export const HELIOS_SPECIALIST_ROLES = [
  'OPPORTUNITY_RESEARCH',
  'MACRO_FX',
  'STAT_ARB_RELATIVE_VALUE',
  'VOLATILITY',
  'MICROSTRUCTURE',
  'EXECUTION_RESEARCH',
  'EVIDENCE_VERIFIER',
  'ADVERSARIAL_CRITIC',
  'META_ALLOCATOR',
] as const;

export type HeliosSpecialistRole = (typeof HELIOS_SPECIALIST_ROLES)[number];

export const SPECIALIST_RECOMMENDATIONS = [
  'INVESTIGATE',
  'SUPPORT',
  'OPPOSE',
  'WAIT',
  'ABANDON',
] as const;

export type SpecialistRecommendation = (typeof SPECIALIST_RECOMMENDATIONS)[number];

export const MESH_COMPLETION_STATES = [
  'COMPLETE',
  'PARTIAL',
  'DEGRADED',
  'INSUFFICIENT_EVIDENCE',
  'FAILED',
] as const;

export type MeshCompletionState = (typeof MESH_COMPLETION_STATES)[number];

export const SPECIALIST_TASK_STATES = [
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'TIMED_OUT',
  'FAILED',
  'CANCELLED',
  'SKIPPED',
] as const;

export type SpecialistTaskState = (typeof SPECIALIST_TASK_STATES)[number];

export const OPPORTUNITY_KINDS = [
  'CASH_YIELD',
  'RELATIVE_VALUE',
  'MACRO_HEDGE',
  'DIRECTIONAL_EQUITY',
  'GENERIC',
] as const;

export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];

export const MODEL_PROVIDERS = ['GROK', 'S3M', 'LOCAL_DETERMINISTIC'] as const;
export type ModelProvider = (typeof MODEL_PROVIDERS)[number];

export const PRIVACY_CLASSES = ['PUBLIC_RESEARCH', 'CUSTOMER_PRIVATE'] as const;
export type PrivacyClass = (typeof PRIVACY_CLASSES)[number];

export type EvidenceReference = {
  readonly evidenceId: string;
  readonly sourceKind: 'MARKET_OBSERVATION' | 'MANDATE' | 'PORTFOLIO' | 'EXTERNAL_PUBLIC' | 'ASSERTION';
  readonly sourceRef: string;
  readonly observedAt: UtcInstant;
  readonly freshnessOk: boolean;
  readonly entitlementOk: boolean;
  readonly provenanceRef: string;
};

export type SpecialistUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly inferenceCalls: number;
  readonly toolCalls: number;
  readonly costMicros: bigint;
  readonly currency: string;
};

export type SpecialistLineage = {
  readonly modelProvider: ModelProvider;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly promptTemplateId: string;
  readonly promptTemplateVersion: string;
  readonly sharedEvidenceIds: readonly string[];
  readonly sharedUpstreamSourceRefs: readonly string[];
  readonly toolLineage: readonly string[];
};

export type SpecialistTaskInput = {
  readonly taskId: string;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly role: HeliosSpecialistRole;
  readonly objective: string;
  readonly opportunityKind: OpportunityKind;
  readonly privacyClass: PrivacyClass;
  readonly candidateRef?: string;
  readonly contextRef: string;
  readonly deadlineAt: UtcInstant;
  readonly approvedTools: readonly string[];
  readonly evidenceBundle: readonly EvidenceReference[];
  readonly priorOutputs: readonly SpecialistTaskOutput[];
  readonly customerPrivateContext?: readonly string[];
};

export type SpecialistTaskOutput = {
  readonly outputId: string;
  readonly taskId: string;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly specialistRole: HeliosSpecialistRole;
  readonly task: string;
  readonly model: {
    readonly provider: ModelProvider;
    readonly modelId: string;
    readonly version: string;
  };
  readonly toolsUsed: readonly string[];
  readonly evidenceReferences: readonly EvidenceReference[];
  readonly findings: readonly string[];
  readonly assumptions: readonly string[];
  readonly contradictions: readonly string[];
  readonly confidence: number | null;
  readonly invalidatingConditions: readonly string[];
  readonly missingInformation: readonly string[];
  readonly recommendation: SpecialistRecommendation;
  readonly usage: SpecialistUsage;
  readonly timestamps: {
    readonly startedAt: UtcInstant;
    readonly completedAt: UtcInstant;
  };
  readonly lineage: SpecialistLineage;
  readonly taskState: SpecialistTaskState;
  readonly narrative?: string;
  readonly grantsFinancialAuthority: false;
};

export type SpecialistNodeSpec = {
  readonly role: HeliosSpecialistRole;
  readonly objective: string;
  readonly approvedTools: readonly string[];
  readonly inputSchema: string;
  readonly outputSchema: string;
  readonly capabilityScope: readonly string[];
  readonly defaultProvider: ModelProvider;
  readonly fallbackProvider: ModelProvider | null;
  readonly researchBudgetCeilingMicros: bigint;
  readonly timeoutMs: number;
  readonly maxIterations: number;
  readonly failureState: SpecialistTaskState;
};

export type ResearchMeshBudgetLimits = {
  readonly workOrderCeilingMicros: bigint;
  readonly taskCeilingMicros: bigint;
  readonly specialistCeilingMicros: bigint;
  readonly concurrencyLimit: number;
  readonly defaultTimeoutMs: number;
  readonly maxIterations: number;
};

export type ResearchMeshBudgetSnapshot = {
  readonly workOrderId: string;
  readonly reservedMicros: bigint;
  readonly spentMicros: bigint;
  readonly remainingMicros: bigint;
  readonly activeTasks: number;
};

export type IndependenceAssessment = {
  readonly evidenceId: string;
  readonly sourceRef: string;
  readonly corroborationCount: number;
  readonly independentCorroborationCount: number;
  readonly sharedModelWarning: boolean;
  readonly sharedEvidenceWarning: boolean;
  readonly treatedAsIndependent: boolean;
};

export type SpecialistView = {
  readonly role: HeliosSpecialistRole;
  readonly recommendation: SpecialistRecommendation;
  readonly summary: string;
  readonly evidenceStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'UNSUPPORTED';
  readonly outputId: string;
};

export type DisagreementRecord = {
  readonly topic: string;
  readonly supportingViews: readonly SpecialistView[];
  readonly opposingViews: readonly SpecialistView[];
  readonly unresolvedQuestions: readonly string[];
  readonly evidenceStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'UNSUPPORTED';
  readonly resolveCostMicros: bigint;
  readonly materiality: 'HIGH' | 'MEDIUM' | 'LOW';
};

export type MetaAllocatorOutput = {
  readonly outputId: string;
  readonly completionState: MeshCompletionState;
  readonly recommendation: SpecialistRecommendation;
  readonly supportingViews: readonly SpecialistView[];
  readonly opposingViews: readonly SpecialistView[];
  readonly disagreements: readonly DisagreementRecord[];
  readonly missingRoles: readonly HeliosSpecialistRole[];
  readonly failedRoles: readonly HeliosSpecialistRole[];
  readonly timedOutRoles: readonly HeliosSpecialistRole[];
  readonly cancelledRoles: readonly HeliosSpecialistRole[];
  readonly independenceAssessments: readonly IndependenceAssessment[];
  readonly totalUsage: SpecialistUsage;
  readonly summary: string;
  readonly narrative?: string;
  readonly grantsFinancialAuthority: false;
};

export type ResearchMeshRun = {
  readonly runId: string;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly opportunityKind: OpportunityKind;
  readonly privacyClass: PrivacyClass;
  readonly routedRoles: readonly HeliosSpecialistRole[];
  readonly completionState: MeshCompletionState;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly cancelled: boolean;
};

export type ResearchMeshSnapshot = {
  readonly runs: readonly ResearchMeshRun[];
  readonly taskOutputs: readonly SpecialistTaskOutput[];
  readonly metaOutputs: readonly MetaAllocatorOutput[];
  readonly budgetSnapshots: readonly ResearchMeshBudgetSnapshot[];
};

export type ResearchMeshFailure = {
  readonly code:
    | 'BUDGET_EXHAUSTED'
    | 'CONCURRENCY_LIMIT'
    | 'SUBJECT_MISMATCH'
    | 'CANCELLED'
    | 'RUN_NOT_FOUND'
    | 'VALIDATION_FAILED'
    | 'PRIVATE_CONTEXT_ROUTING_REFUSED';
  readonly message: string;
};
