# Phase F Prompt 1 — Production AI Model Gateway and inference runtime

`CORE_CODE_COMPLETE_CANDIDATE=true`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`production_authorized=false`
`ENVIRONMENT=simulation`

This prompt productizes one canonical AI Model Gateway. It does not
start Prompt 2. It does not activate live model vendors, flip `LIVE_*`
flags, or give the AI financial authority.

Phase E closure is present after merging `main`
(`docs/productization/PHASE_E_CLOSURE_REPORT.md`). This prompt extends
the existing Chunk 101/102 inference plane rather than inventing a
second one. The Phase E merge mashed `services/api.allowedDependencies`
and the constitution import table; this prompt repairs those to one
valid allow-list. It does not create a second API owner.

`SAFE_TO_PROCEED_TO_PHASE_F_PROMPT_2=true`

## Canonical owner

The freeze names `AI_MODEL_GATEWAY` at `packages/ai-runtime` /
`packages/ai-runtime/src/runtime.ts`. Phase F extends that owner.

| Concern | Path |
| --- | --- |
| Canonical runtime | `packages/ai-runtime/src/runtime.ts` |
| Productized Model Gateway | `packages/ai-runtime/src/gateway.ts` |
| Provider contract | `packages/ai-runtime/src/provider.ts` |
| Inference Model Catalog | `packages/ai-runtime/src/catalog.ts` |
| Policy routing | `packages/ai-runtime/src/routing-policy.ts` |
| HTTPS transport port | `packages/ai-runtime/src/transport.ts` |
| Streaming / SSE | `packages/ai-runtime/src/streaming.ts` |
| Privacy / envelope | `packages/ai-runtime/src/privacy.ts`, `envelope.ts` |
| Prompt policy versions | `packages/ai-runtime/src/prompt-policy.ts` |
| Usage telemetry | `packages/ai-runtime/src/usage.ts` |
| Agent port | `packages/sunrey-agent/src/model-gateway.ts` |
| Lovable Agent conversation | `POST /api/v1/agent/conversations/{id}/messages` |

Do not create `packages/ai-gateway`, `packages/llm`, `packages/model-gateway`,
or a second Agent runtime.

Governance model registration remains `packages/model-registry`. The
inference catalog is the AI-specific metadata/routing plane on top of
those simulation bindings. It is not a second risk-model registry.

## Provider classification

| Provider | Classification | Notes |
| --- | --- | --- |
| `LOCAL_TEST` | TEST-ONLY / SIMULATION-ONLY | Deterministic fixtures. No network. |
| `S3M` | PRODUCTION-CAPABLE architecture / SIMULATION-ONLY | Primary intelligence adapter. Transport is injectable. No proprietary engine is connected. |
| `HTTPS_GENERIC` | NETWORK-CAPABLE / SIMULATION-ONLY | Vendor-neutral HTTPS port. Fixture transport only. Live connectivity stays false. |
| `XAI_GROK` | STUB / RESERVED | Chunk 103. Refuses inference. |
| OpenAI / Anthropic / Mistral catalog rows | DISABLED / RESERVED | Registered so Agent code never imports a vendor SDK. |

An environment variable cannot move a model to `PRODUCTION_APPROVED`.

## What the AI may and may not do

The AI may analyze, explain, search approved context, call controlled
tools, create structured proposals, and request approval.

The AI may not write ledger entries, execute payments, self-approve,
bypass Kernel or Execution Authority, use master signing keys, activate
providers, alter governance, or mint native assets.

A model outage is not a financial failure.

## Streaming

Server-side events:

`message.started` → `message.delta` → `tool.started` / `tool.completed`
→ `proposal.created` → `message.completed` / `error`

Hidden chain-of-thought is not persisted or streamed.
`hiddenReasoning` is always `false`.

Lovable calls Agent conversation routes. Agent Runtime calls the Model
Gateway. There is no public `/api/v1/llm` or completions endpoint.

## Production posture

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

No live API credentials are required. Deterministic providers remain
the CI path.
