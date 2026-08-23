import { ENVIRONMENT, LIVE_INVESTMENT_EXECUTION, LIVE_MONEY_ENABLED, LIVE_PAYMENTS_ENABLED } from '../../../config/src/flags.ts';
import { AGENT_TOOL_CATALOG } from './tools.ts';
import { LOVABLE_AGENT_CONTRACT } from './lovable.ts';
import { AGENT_SAFETY_INVARIANT_IDS, type AgentReadinessClass } from './taxonomy.ts';

export type AgentDomainQualification = {
  readonly domain:
    | 'MODEL_GATEWAY'
    | 'AGENT_RUNTIME'
    | 'MEMORY'
    | 'TOOL_RUNTIME'
    | 'FINANCIAL_PROPOSALS'
    | 'ACTION_CENTER'
    | 'AGENT_SAFETY'
    | 'EVALUATION_PLATFORM';
  readonly classification: AgentReadinessClass;
  readonly notes: string;
};

export const AGENT_DOMAIN_QUALIFICATION: readonly AgentDomainQualification[] = Object.freeze([
  {
    domain: 'MODEL_GATEWAY',
    classification: 'SANDBOX_FUNCTIONAL',
    notes: 'packages/ai-runtime plus fixture providers. Real vendor connection is EXTERNAL_PROVIDER_REQUIRED.',
  },
  {
    domain: 'AGENT_RUNTIME',
    classification: 'SANDBOX_FUNCTIONAL',
    notes: 'Mandates, identity, and in-memory persistence. Durable production store remains a later gate.',
  },
  {
    domain: 'MEMORY',
    classification: 'SANDBOX_FUNCTIONAL',
    notes: 'Classified memory; PEG stays a separate read model. Not a second graph.',
  },
  {
    domain: 'TOOL_RUNTIME',
    classification: 'SANDBOX_FUNCTIONAL',
    notes: `${String(AGENT_TOOL_CATALOG.length)} typed tools. Mutation tools create proposals only.`,
  },
  {
    domain: 'FINANCIAL_PROPOSALS',
    classification: 'SANDBOX_FUNCTIONAL',
    notes: 'Payment, FX, Growth, Exchange, and portfolio cards. Execution Authority stays outside the Agent.',
  },
  {
    domain: 'ACTION_CENTER',
    classification: 'SANDBOX_FUNCTIONAL',
    notes: 'Human approval, step-up, and domain-sourced status.',
  },
  {
    domain: 'AGENT_SAFETY',
    classification: 'PRODUCTIZED_INTERNAL',
    notes: `${String(AGENT_SAFETY_INVARIANT_IDS.length)} machine-testable invariants. Safety does not depend on vendor refusal.`,
  },
  {
    domain: 'EVALUATION_PLATFORM',
    classification: 'PRODUCTIZED_INTERNAL',
    notes: 'Versioned suites with model-swap fixture providers.',
  },
]);

export const PHASE_F_FLAGS = Object.freeze({
  CORE_CODE_COMPLETE_CANDIDATE: true,
  PRODUCTION_READY: false,
  PRODUCTION_ACTIVE: false,
  LIVE_CONNECTIVITY_ENABLED: false,
  MODEL_GATEWAY_PRODUCTIZED: true,
  AGENT_RUNTIME_PRODUCTIZED: true,
  AGENT_MEMORY_PRODUCTIZED: true,
  AGENT_TOOL_RUNTIME_PRODUCTIZED: true,
  AGENT_FINANCIAL_PROPOSALS_PRODUCTIZED: true,
  AGENT_SAFETY_PLATFORM_PRODUCTIZED: true,
  LOVABLE_AGENT_BACKEND_READY: true,
  REAL_AI_PROVIDER_CONNECTED: false,
  LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED: false,
  READY_FOR_PHASE_G: true,
  ENVIRONMENT,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
  LIVE_INVESTMENT_EXECUTION,
  lovableComponents: LOVABLE_AGENT_CONTRACT.map((row) => row.component),
});

export const EXTERNAL_MODEL_READINESS_CHECKLIST = Object.freeze([
  'DPA_DATA_TERMS',
  'DATA_RETENTION',
  'MODEL_VERSION',
  'REGIONAL_PROCESSING',
  'PRIVACY_CLASSIFICATION',
  'CREDENTIALS',
  'RATE_LIMITS',
  'COST',
  'MODEL_EVAL_PASS',
  'PROMPT_INJECTION_PASS',
  'TOOL_USE_EVAL_PASS',
  'FINANCIAL_HALLUCINATION_PASS',
  'SECURITY_REVIEW',
  'PREPRODUCTION_APPROVAL',
] as const);
