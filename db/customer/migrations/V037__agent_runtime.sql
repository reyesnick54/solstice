-- V037 Phase F Prompt 2 — SunRey Agent runtime, conversations, and memory.
-- Conversational state only. Not a ledger, not Execution Authority,
-- and not a second PEG. Production remains disabled.

CREATE SCHEMA IF NOT EXISTS agent_runtime;

CREATE TABLE agent_runtime.agent (
  agent_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  identity_kind TEXT NOT NULL CHECK (identity_kind = 'SUNREY_AGENT'),
  agent_type TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CREATED', 'ACTIVE', 'PAUSED', 'RESTRICTED', 'REVOKED', 'ARCHIVED')),
  model_ref TEXT NOT NULL,
  policy_ref TEXT NOT NULL,
  mandate_id TEXT,
  jurisdiction TEXT,
  risk_policy_id TEXT NOT NULL,
  is_customer BOOLEAN NOT NULL CHECK (is_customer = FALSE),
  is_execution_authority BOOLEAN NOT NULL CHECK (is_execution_authority = FALSE),
  receives_master_key BOOLEAN NOT NULL CHECK (receives_master_key = FALSE),
  created_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL
);

CREATE TABLE agent_runtime.mandate (
  mandate_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agent_runtime.agent (agent_id),
  owner_id TEXT NOT NULL,
  state TEXT NOT NULL,
  assist_scopes TEXT[] NOT NULL,
  body_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CHECK (NOT ('DIRECT_LEDGER_WRITE' = ANY (assist_scopes))),
  CHECK (NOT ('BYPASS_KERNEL' = ANY (assist_scopes))),
  CHECK (NOT ('SELF_APPROVE' = ANY (assist_scopes))),
  CHECK (NOT ('MASTER_SIGNING_KEY' = ANY (assist_scopes)))
);

CREATE TABLE agent_runtime.conversation (
  conversation_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES agent_runtime.agent (agent_id),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED', 'DELETED', 'REDACTED')),
  title TEXT NOT NULL,
  context_version INTEGER NOT NULL CHECK (context_version >= 1),
  is_financial_record BOOLEAN NOT NULL CHECK (is_financial_record = FALSE),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE agent_runtime.message (
  message_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES agent_runtime.conversation (conversation_id),
  role TEXT NOT NULL CHECK (role IN ('USER', 'AGENT', 'SYSTEM', 'TOOL')),
  content TEXT NOT NULL,
  visible BOOLEAN NOT NULL,
  hidden_reasoning BOOLEAN NOT NULL CHECK (hidden_reasoning = FALSE),
  proposal_ref TEXT,
  tool_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE agent_runtime.memory (
  memory_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agent_runtime.agent (agent_id),
  owner_id TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence TEXT NOT NULL,
  user_editable BOOLEAN NOT NULL,
  data_classification TEXT NOT NULL,
  personalization BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ
);

CREATE TABLE agent_runtime.snapshot (
  snapshot_id TEXT PRIMARY KEY,
  grants_execution_authority BOOLEAN NOT NULL CHECK (grants_execution_authority = FALSE),
  body_canonical TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX agent_runtime_agent_owner_idx ON agent_runtime.agent (owner_id);
CREATE INDEX agent_runtime_conversation_owner_idx ON agent_runtime.conversation (owner_id, agent_id);
CREATE INDEX agent_runtime_memory_owner_idx ON agent_runtime.memory (owner_id, agent_id);

REVOKE ALL ON SCHEMA agent_runtime FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA agent_runtime FROM PUBLIC;

GRANT USAGE ON SCHEMA agent_runtime TO customer_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA agent_runtime TO customer_app;
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA agent_runtime FROM customer_app;
