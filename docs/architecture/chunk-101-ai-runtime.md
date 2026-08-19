# Chunk 101 — SunRey canonical AI runtime and model provider abstraction

Canonical owner: `packages/ai-runtime`.

Capability `sunrey-ai-runtime` is `IMPLEMENTED`.

This chunk is the inference plane behind the existing SunRey Financial
Agent. It does not create a second Financial Agent, Execution Authority
issuer, wallet, Exchange, risk engine, or ledger.

See [`docs/ai/chunk-101-ai-runtime.md`](../ai/chunk-101-ai-runtime.md).

## Authority rule

AI providers reason and may request bounded tool intents. Execution
remains `packages/sunrey-agent` → ProposalGate → Compliance Kernel →
wallet authorization.

S3M is the intended primary intelligence engine. xAI/Grok is reserved
for Chunk 103 and is not networked here.

## What it implements

- Canonical provider contract `AiInferenceProvider`
- Deterministic `AiRuntimeRouter` and fail-closed context release
- Structured output validation with integer money quantities
- Bounded `AiToolIntent` surface and `ToolIntentBroker`
- LocalTest fixtures for CI
- Model-registry bindings for LocalTest / S3M / reserved Grok
- Inference traces without raw secrets or default prompt storage
- A Financial Agent inference port that still uses ProposalGate

## What it does not do

- Sign, mint, post journals, or issue Execution Authority
- Hold wallet master keys
- Bypass Kernel, risk, jurisdiction, or human approval
- Implement Grok networking
- Create `packages/ai-engine`, `packages/model-runtime`,
  `packages/grok-runtime`, `packages/s3m`, `packages/llm`, or
  `packages/inference-v2`
