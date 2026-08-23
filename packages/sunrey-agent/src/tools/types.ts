import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AgentActionClass } from '../taxonomy.ts';

export const TOOL_CATEGORIES = [
  'READ_FINANCIAL',
  'PAYMENTS',
  'FX',
  'GROW',
  'PORTFOLIO',
  'EXCHANGE',
  'WALLETS_CUSTODY',
  'CARDS',
  'DATA',
] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const TOOL_RISK_CLASSES = [
  'READ',
  'PROPOSAL',
  'SAFE_USER_PREFERENCE',
  'PRIVILEGED_FINANCIAL_MUTATION',
] as const;
export type ToolRiskClass = (typeof TOOL_RISK_CLASSES)[number];

export const TOOL_RESULT_STATUSES = [
  'SUCCESS',
  'ACTION_REQUIRED',
  'APPROVAL_REQUIRED',
  'NOT_ELIGIBLE',
  'UNAVAILABLE',
  'FAILED',
] as const;
export type ToolResultStatus = (typeof TOOL_RESULT_STATUSES)[number];

export const TOOL_ENVIRONMENTS = ['simulation', 'sandbox'] as const;
export type ToolEnvironment = (typeof TOOL_ENVIRONMENTS)[number];

export const TOOL_DATA_CLASSES = [
  'PUBLIC',
  'FINANCIAL_PRIVATE',
  'PERSONAL_SENSITIVE',
  'REGULATORY_SENSITIVE',
] as const;
export type ToolDataClass = (typeof TOOL_DATA_CLASSES)[number];

export const LOVABLE_COMPONENT_HINTS = [
  'ACCOUNT_CARD',
  'PAYMENT_QUOTE',
  'FX_QUOTE',
  'GROWTH_OPPORTUNITY',
  'GROWTH_PROPOSAL',
  'PORTFOLIO_CARD',
  'TRADE_PROPOSAL',
  'APPROVAL_CARD',
  'TRANSACTION_STATUS',
] as const;
export type LovableComponentHint = (typeof LOVABLE_COMPONENT_HINTS)[number];

export const PRIVILEGED_MODEL_FIELDS = [
  'userId',
  'approvalStatus',
  'complianceApproved',
  'KernelApproved',
  'kernelApproved',
  'executionAuthorized',
  'providerId',
  'LedgerAccountOverride',
  'ledgerAccountOverride',
] as const;
export type PrivilegedModelField = (typeof PRIVILEGED_MODEL_FIELDS)[number];

export const SCHEMA_FIELD_TYPES = [
  'string',
  'minor_units',
  'currency',
  'enum',
  'boolean',
  'integer',
  'object',
] as const;
export type SchemaFieldType = (typeof SCHEMA_FIELD_TYPES)[number];

export type ToolSchemaField = {
  readonly type: SchemaFieldType;
  readonly required?: boolean;
  readonly enum?: readonly string[];
  readonly properties?: Readonly<Record<string, ToolSchemaField>>;
  readonly description?: string;
};

export type ToolJsonSchema = {
  readonly type: 'object';
  readonly additionalProperties: false;
  readonly properties: Readonly<Record<string, ToolSchemaField>>;
};

export type AgentToolDefinition = {
  readonly toolId: string;
  readonly version: string;
  readonly identityHash: string;
  readonly description: string;
  readonly category: ToolCategory;
  readonly inputSchema: ToolJsonSchema;
  readonly outputSchema: ToolJsonSchema;
  readonly requiredMandate: AgentActionClass | 'NONE';
  readonly requiredCapabilities: readonly string[];
  readonly riskClass: ToolRiskClass;
  readonly readOnly: boolean;
  readonly createsProposal: boolean;
  readonly requiresUserApproval: boolean;
  readonly requiredDataClasses: readonly ToolDataClass[];
  readonly timeoutMs: number;
  readonly enabledEnvironments: readonly ToolEnvironment[];
  readonly domainDependency: string;
  readonly purpose: string;
  readonly classification: ToolAuditClass;
};

export const TOOL_AUDIT_CLASSES = [
  'CANONICAL',
  'DUPLICATE',
  'SIMULATION',
  'INCOMPLETE',
  'UNSAFE',
  'DEPRECATED',
] as const;
export type ToolAuditClass = (typeof TOOL_AUDIT_CLASSES)[number];

export type MoneyView = {
  readonly minorUnits: string;
  readonly currency: string;
};

export type ToolCallInput = Readonly<Record<string, unknown>>;

export type ToolRenderingHint = {
  readonly component: LovableComponentHint;
  readonly authoritativeNumericPaths: readonly string[];
  readonly modelMaySummarize: true;
  readonly modelMayAlterAuthoritativeNumbers: false;
};

export type ToolResultError = {
  readonly code: string;
  readonly safeMessage: string;
  readonly inventingNumbersForbidden: true;
};

export type AgentToolResult = {
  readonly status: ToolResultStatus;
  readonly toolId: string;
  readonly version: string;
  readonly executed: false;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly rendering: ToolRenderingHint | null;
  readonly error: ToolResultError | null;
  readonly proposalId: string | null;
  readonly workflowId: string | null;
  readonly correlationId: string;
  readonly durationMs: number;
};

export type AgentLifecycleState = 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';

export type ToolSession = {
  readonly conversationId: string;
  readonly turnId: string;
  readonly correlationId: string;
  readonly agentId: string;
  readonly agentState: AgentLifecycleState;
  readonly mandateId: string;
  readonly ownerId: string;
  readonly sessionOwnerId: string;
  readonly accountId: string;
  readonly walletId: string;
  readonly actorId: string;
  readonly environment: ToolEnvironment;
  readonly jurisdictionAvailable: boolean;
  readonly purpose: string;
  readonly allowedDataClasses: readonly ToolDataClass[];
  readonly productCapabilities: readonly string[];
  readonly approvedToolVersions: Readonly<Record<string, readonly string[]>>;
  readonly modelText: string;
  readonly now: UtcInstant;
};

export type StructuredToolCall = {
  readonly toolId: string;
  readonly version?: string;
  readonly input: ToolCallInput;
};

export type ToolInvocationEvidence = {
  readonly evidenceId: string;
  readonly agentId: string;
  readonly ownerId: string;
  readonly conversationId: string;
  readonly turnId: string;
  readonly toolId: string;
  readonly toolVersion: string;
  readonly inputHash: string;
  readonly redactedInput: Readonly<Record<string, unknown>>;
  readonly authorizationResult: string;
  readonly resultStatus: ToolResultStatus;
  readonly resultReference: string;
  readonly startedAt: UtcInstant;
  readonly endedAt: UtcInstant;
  readonly durationMs: number;
  readonly correlationId: string;
};

export type ExistingToolAuditRow = {
  readonly path: string;
  readonly name: string;
  readonly classification: ToolAuditClass;
  readonly notes: string;
};
