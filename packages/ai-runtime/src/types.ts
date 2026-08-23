import type { UtcInstant } from '../../domain/src/time.ts';
import type { ModelId, ModelVersion } from '../../model-registry/src/ids.ts';
import type { SecretReference } from '../../security/src/secrets.ts';
import type { AiProviderId, AiRequestId, AiToolIntentId, AiTraceId } from './ids.ts';
import type {
  AiDataClass,
  AiFailureCode,
  AiProviderKind,
  AiRuntimeMode,
  AiStructuredKind,
  AiTaskClass,
  AiToolIntentName,
  LocalTestFixture,
} from './taxonomy.ts';

export type AiModelReference = {
  readonly modelId: ModelId;
  readonly version: ModelVersion;
};

export type AiProviderUsage = {
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly totalTokens: number | null;
  readonly latencyMs?: number | null;
  readonly estimatedCostMicros?: string | null;
};

export type AiProviderHealth = {
  readonly providerId: AiProviderId;
  readonly kind: AiProviderKind;
  readonly healthy: boolean;
  readonly reason: string | null;
  readonly checkedAt: UtcInstant;
  readonly networkEnabled: boolean;
  readonly liveConnectivity?: false;
};

export type AiProviderCapabilities = {
  readonly kind: AiProviderKind;
  readonly supportsStructuredOutput: boolean;
  readonly supportsToolIntents: boolean;
  readonly supportsStreaming: boolean;
  readonly supportsCancellation: boolean;
  readonly externalNetwork: boolean;
  readonly mayReceivePrivateKeys: false;
  readonly mayExecuteFinancialActions: false;
  readonly mayIssueExecutionAuthority: false;
};

export type AiProviderMetadata = {
  readonly providerId: AiProviderId;
  readonly kind: AiProviderKind;
  readonly label: string;
  readonly credentialRef: SecretReference | null;
  readonly implemented: boolean;
};

export type AiContextObject = {
  readonly objectId: string;
  readonly dataClass: AiDataClass;
  readonly authorizedProviders: readonly AiProviderKind[];
  readonly userApproved: boolean;
  readonly payload: Readonly<Record<string, unknown>>;
};

export type AiContextAuthorization = {
  readonly actorId: string;
  readonly subjectId: string;
  readonly userApprovedExternal: boolean;
  readonly mandateId: string | null;
  readonly agentId: string | null;
};

export type AiInferenceRequest = {
  readonly requestId: AiRequestId;
  readonly taskClass: AiTaskClass;
  readonly mode: AiRuntimeMode;
  readonly modelRef: AiModelReference;
  readonly dataClass: AiDataClass;
  readonly jurisdictionRef: string | null;
  readonly authorization: AiContextAuthorization;
  readonly prompt: string;
  readonly context: readonly AiContextObject[];
  readonly fixture?: LocalTestFixture;
};

export type AiMoneyQuantity = {
  readonly minorUnits: string;
  readonly currency: string;
};

export type AiToolIntent = {
  readonly intentId: AiToolIntentId;
  readonly name: AiToolIntentName;
  readonly rationale: string;
  readonly assetId: string | null;
  readonly quantity: AiMoneyQuantity | null;
  readonly destinationOrMarket: string | null;
  readonly fees: AiMoneyQuantity | null;
  readonly executes: false;
};

export type AiToolResult = {
  readonly intentId: AiToolIntentId;
  readonly name: AiToolIntentName;
  readonly ok: boolean;
  readonly detail: string;
  readonly proposalId: string | null;
  readonly executed: false;
};

export type AiStructuredExplanation = {
  readonly kind: 'EXPLANATION';
  readonly text: string;
  readonly guaranteedReturn: false;
};

export type AiStructuredFinancialProposal = {
  readonly kind: 'FINANCIAL_PROPOSAL';
  readonly action: 'PREPARE_PAYMENT' | 'PREPARE_EXCHANGE_ORDER' | 'PREPARE_REBALANCE';
  readonly assetId: string;
  readonly quantity: AiMoneyQuantity;
  readonly destinationOrMarket: string;
  readonly fees: AiMoneyQuantity;
  readonly operationalRationale: string;
  readonly guaranteedReturn: false;
};

export type AiStructuredOutput = AiStructuredExplanation | AiStructuredFinancialProposal;

export type AiInferenceResponse = {
  readonly requestId: AiRequestId;
  readonly providerId: AiProviderId;
  readonly providerKind: AiProviderKind;
  readonly modelRef: AiModelReference;
  readonly text: string | null;
  readonly structured: AiStructuredOutput | null;
  readonly toolIntents: readonly AiToolIntent[];
  readonly usage: AiProviderUsage;
  readonly grantsExecutionAuthority: false;
};

export type AiProviderFailure = {
  readonly ok: false;
  readonly code: AiFailureCode;
  readonly detail: string;
  readonly providerKind: AiProviderKind | null;
};

export type AiRoutingRejection = {
  readonly providerKind: AiProviderKind;
  readonly reason: AiFailureCode;
  readonly detail: string;
};

export type AiRoutingDecision = {
  readonly mode: AiRuntimeMode;
  readonly primary: AiProviderKind | null;
  readonly shadow: AiProviderKind | null;
  readonly modelRef: AiModelReference;
  readonly dataClass: AiDataClass;
  readonly taskClass: AiTaskClass;
  readonly rejected: readonly AiRoutingRejection[];
  readonly reason: string;
  readonly auditable: true;
  readonly providerSelfSelected: false;
  readonly policyModifiedByModel: false;
};

export type AiInferenceTrace = {
  readonly requestId: AiRequestId;
  readonly traceId: AiTraceId;
  readonly agentId: string | null;
  readonly mandateId: string | null;
  readonly provider: AiProviderKind | null;
  readonly modelRef: AiModelReference;
  readonly taskClass: AiTaskClass;
  readonly routingDecision: AiRoutingDecision;
  readonly startedAt: UtcInstant;
  readonly endedAt: UtcInstant;
  readonly success: boolean;
  readonly failureCode: AiFailureCode | null;
  readonly usage: AiProviderUsage;
  readonly toolIntentsRequested: readonly AiToolIntentName[];
  readonly dataClass: AiDataClass;
  readonly redactionStatus: 'REDACTED_DEFAULT' | 'PUBLIC_SYNTHETIC_ALLOWED';
  readonly promptHash: string;
  readonly responseHash: string | null;
  readonly storedRawPrompt: false;
  readonly storedSecrets: false;
};

export type AiStreamChunk = {
  readonly kind: 'token' | 'done' | 'refused';
  readonly text: string;
  readonly requestId: AiRequestId;
  readonly grantsExecutionAuthority: false;
  readonly executedFinancialMutation: false;
};

export type AiRuntimePolicy = {
  readonly mode: AiRuntimeMode;
  readonly allowLocalTestFallback: boolean;
  readonly storeRawPrompts: false;
  readonly allowExternalWithoutUserApproval: false;
  readonly allowPrivateKeyRelease: false;
  readonly s3mUnavailableFallsBackToGrok: false;
  readonly modelMayModifyPolicy: false;
  readonly providerMaySelfSelect: false;
};

export type AiContextReleaseDecision = {
  readonly providerKind: AiProviderKind;
  readonly allowed: boolean;
  readonly releasedObjectIds: readonly string[];
  readonly deniedObjectIds: readonly string[];
  readonly code: AiFailureCode | null;
  readonly failClosed: true;
};

export type AiChatMessage = {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
};

export type AiCancellationToken = {
  cancelled: boolean;
  cancel(): void;
};

export type CanonicalProviderRequest = {
  readonly requestId: AiRequestId;
  readonly taskClass: AiTaskClass;
  readonly modelRef: AiModelReference;
  readonly promptHash: string;
  readonly releasedContext: readonly AiContextObject[];
  readonly fixture?: LocalTestFixture;
  readonly messages?: readonly AiChatMessage[];
  readonly systemPolicy?: string;
  readonly tools?: readonly string[];
  readonly responseSchema?: 'EXPLANATION' | 'FINANCIAL_PROPOSAL' | null;
  readonly temperatureMilli?: number | null;
  readonly maxOutputTokens?: number | null;
  readonly correlationId?: string;
  readonly agentId?: string | null;
  readonly purpose?: string;
  readonly cancel?: AiCancellationToken;
  readonly repairAttempt?: number;
};

export type { AiStructuredKind };
