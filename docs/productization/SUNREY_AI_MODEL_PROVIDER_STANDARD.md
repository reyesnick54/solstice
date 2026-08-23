# SunRey AI model provider standard

Binding contract for inference providers behind the canonical Model
Gateway (`packages/ai-runtime`). Companion to
`docs/productization/PHASE_F_01_AI_MODEL_GATEWAY.md` and
`docs/productization/SUNREY_PROVIDER_INTEGRATION_STANDARD.md`.

This is not production authorization and not financial-provider
certification.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

## 1. Provider contract

SunRey Agent code consumes only `AiInferenceProvider`:

- `infer`
- `stream` (optional; Gateway can synthesize customer-safe events)
- `health`
- `capabilities`
- `providerMetadata`
- `cancel` (optional)

Vendor request/response objects stay inside the adapter. Do not import
OpenAI, xAI, Anthropic, S3M, or Mistral SDKs into `packages/sunrey-agent`
or frontend clients.

Structured request fields:

- model (catalog-selected; not arbitrary frontend selection for privileged workflows)
- messages / context
- versioned system policy
- tools
- response schema where supported
- temperature as integer milli-units where allowed
- max output
- correlation ID
- Agent identity
- request purpose

## 2. Model Registry / Catalog

Governance versions remain in `packages/model-registry`
(`APPROVED_FOR_SIMULATION` only).

The inference catalog (`packages/ai-runtime/src/catalog.ts`) stores:

- `modelId`, `provider`, `providerModel`, `version`
- capabilities, `contextWindow`
- `supportsStreaming`, `supportsTools`, `supportsStructuredOutput`
- `approvedPurposes`
- `environment`, `status`
- cost metadata (integer micros / 1k tokens)
- latency class
- data-handling / privacy classes
- jurisdiction restrictions

Statuses: `DISABLED`, `TEST`, `APPROVED_SANDBOX`, `APPROVED_INTERNAL`,
`PREPRODUCTION`, `PRODUCTION_APPROVED`.

`PRODUCTION_APPROVED` is unreachable while `ENVIRONMENT=simulation` and
`production_authorized=false`. Changing an environment variable does
not approve a model.

## 3. Routing

Routing is filter-then-rank:

1. purpose approval
2. privacy / data classification
3. required capability (tools, structured output, streaming)
4. context window
5. jurisdiction restriction
6. availability / health
7. approved provider preference
8. latency class
9. cost ceiling (never the only score)

Examples:

- financial explanation → approved language model (S3M when healthy)
- structured proposal narration → structured-output-capable model
- simple classification → lower-cost approved model after filters

Providers and models cannot self-select or modify policy.

## 4. Privacy classes

`PUBLIC`, `INTERNAL`, `PERSONAL`, `FINANCIAL_SENSITIVE`,
`REGULATED_IDENTITY`, `SECRET`.

`REGULATED_IDENTITY` and `SECRET` are never released.

KYC documents, private keys, full payment credentials, and provider
secrets must not enter model context.

External providers may receive only `PUBLIC` (and historically
`SYNTHETIC`) with explicit user approval.

## 5. Context minimization

Use `minimizeContext`. Send only purpose-allowlisted fields. Do not
dump entire user records or database rows.

## 6. Streaming

Encode `AiStreamEvent` as Server-Sent Events:

```
event: message.delta
data: {"type":"message.delta","text":"...","hiddenReasoning":false}
```

Do not stream hidden reasoning.

Lovable path: `POST /api/v1/agent/conversations/{conversationId}/messages`.

## 7. Structured output

`MODEL RESPONSE → SCHEMA VALIDATION → ACCEPT | REPAIR/RETRY WITH BOUNDS | SAFE FAILURE`.

Never execute an unvalidated model-generated financial object.
Quantities are integer minor-unit strings. `guaranteedReturn` is always
`false`.

## 8. Fallback

Fallback must preserve purpose approval, data classification, tool
compatibility, and structured-output requirements.

Do not send financial-sensitive context to an unapproved fallback vendor.
S3M unavailability does not silently route sensitive traffic to Grok.

## 9. Cost / usage

Track provider, model, input/output tokens, latency, estimated provider
cost (integer micros), Agent, user, conversation, and purpose.

This is operational telemetry. Do not post AI token costs to the
customer Ledger.

## 10. Policy versioning

System prompts live in `PromptPolicyRegistry`:

- `policyId`, `version`, `purpose`
- `approvedModelClasses`
- `createdAt`, `status`

Agent behavior must not depend on undocumented prompt strings scattered
through source files.

## 11. Provenance

Record model, provider, version, policy version, request ID, timestamp,
tool schema version, and output validation status. Do not persist hidden
reasoning.

## 12. Failure states

Normalize to Lovable-safe codes:

- `MODEL_UNAVAILABLE`
- `MODEL_TIMEOUT`
- `MODEL_RATE_LIMITED`
- `MODEL_OUTPUT_INVALID`
- `MODEL_CONTEXT_TOO_LARGE`
- `MODEL_POLICY_BLOCKED`
- `MODEL_PROVIDER_ERROR`
- `MODEL_CANCELLED`

A model outage is not a financial failure if no financial action has
executed.

## 13. Cache

Default personalized Agent responses are private / no shared cache.
Deterministic non-sensitive outputs may use `SCOPED_NON_PERSONAL` only.
Never cache personalized financial responses across users.

## 14. Transport

HTTPS-only port with explicit timeout, cancellation, typed errors,
rate-limit handling, request correlation, and secret-reference
credentials. No API keys in source. Live sockets are not opened by
`packages/ai-runtime`; tests use `FixtureHttpsTransport`.

Reuse Phase D concepts (environment, credentials, health, timeout,
rate limit, circuit breaker, lifecycle) without forcing model providers
into financial-provider interfaces. `packages/ai-runtime` must not
import `packages/sunrey-chain`.

## 15. External model onboarding

1. Implement `AiInferenceProvider` under `packages/ai-runtime/src/providers`.
2. Bind credentials as `secret://` references only.
3. Register catalog metadata with `liveApproved=false`.
4. Seed a versioned prompt policy for approved purposes.
5. Add deterministic fixture tests (no live credentials).
6. Keep status at `TEST` or `APPROVED_SANDBOX` until a later authorized
   production gate.

Do not create `packages/openai`, `packages/anthropic`, `packages/mistral`,
or `packages/grok-runtime`.
