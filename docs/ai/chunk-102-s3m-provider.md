# Chunk 102 — S3M primary AI provider for SunRey

S3M is the proprietary primary intelligence provider for the SunRey
AI Agent. SunRey talks to S3M only through a bounded inference-provider
adapter inside `packages/ai-runtime`.

The SunRey financial operating system remains independent from the
model. S3M can be upgraded, retrained, or replaced without changing
the ledger, wallet, Compliance Kernel, or Execution Authority.

This repository does not contain the S3M training system. The adapter
does not invent undocumented S3M HTTP routes. Endpoint paths are an
explicit transport contract (`S3M_INFERENCE_PATH`, `S3M_HEALTH_PATH`).
Local tests use an in-process simulator so no real S3M server or
network is required.

## Canonical owner

`packages/ai-runtime/src/providers/s3m`.

Capability `sunrey-s3m-provider` is `IMPLEMENTED`.

The runtime contract remains Chunk 101 (`AiInferenceProvider`,
`AiRuntimeRouter`, structured-output validation). Grok remains a
future beta/demo provider and is not implemented here.

## Configuration

- `S3M_BASE_URL`
- `S3M_MODEL_ID`
- `S3M_MODEL_VERSION`
- `S3M_TIMEOUT_MS`
- optional opaque paths `S3M_INFERENCE_PATH` and `S3M_HEALTH_PATH`
- optional `S3M_CREDENTIAL_REF` resolved through `SecretProvider`

Credentials are never hard-coded. Secrets must not appear in logs,
traces, or safety events.

## What S3M may do

S3M may reason about Grow My Money, the Personal Economic Graph,
financial state, investment opportunities, SunRey Coin, MoonRey Coin,
Exchange markets, payments, and economic optimization.

Its response is advisory / proposal-generation only. A tool request
becomes a canonical `AiToolIntent`. Financial proposals still enter
`packages/sunrey-agent` and stop at ProposalGate.

## What S3M cannot do

S3M cannot sign, approve, execute, mint, change policy, change a
mandate, hold master keys, override risk, override jurisdiction, or
override Compliance Kernel decisions.

A prohibited tool request is rejected and emits a safety event.

## Routing

`S3M_PRIMARY` selects S3M when it is healthy and the task is eligible.

If S3M is unavailable:

- `S3M_ONLY` fails closed
- `S3M_PRIMARY` returns a provider-unavailable state unless routing
  policy explicitly permits another configured provider
- private user data is not automatically externalized
- there is no Grok fallback in this chunk

## Resilience

The adapter implements health checks, timeouts, bounded retries,
a circuit breaker, request correlation, and failure classification.
Inference is never retried indefinitely.

## Model governance

S3M is bound as an `AI_MODEL_REFERENCE` in `packages/model-registry`
(`mdl_sunrey_s3m@s3m-sim-v1`). The binding records provider, model
id, version, input/output schema, limitations, and supported tasks.
It does not claim real-world model performance.

## Demo

`npm run demo:sunrey-ai-s3m` shows:

User → SunRey Agent → AI Runtime Router → S3M Provider → structured
recommendation / tool intent → Growth / Agent proposal → ProposalGate.

The demo does not claim a guaranteed outcome and does not execute
real money.
