# Chunk 102 — S3M primary AI provider for SunRey

Canonical owner: `packages/ai-runtime` at
`packages/ai-runtime/src/providers/s3m`.

Capability `sunrey-s3m-provider` is `IMPLEMENTED`.

This chunk connects the proprietary S3M engine to the Chunk 101
`AiInferenceProvider` contract. It does not fork S3M training into
this repository and does not create `packages/s3m`.

See [`docs/ai/chunk-102-s3m-provider.md`](../ai/chunk-102-s3m-provider.md).

## Authority rule

S3M is the primary intelligence foundation. The financial operating
system remains independent from the model. S3M can be upgraded,
retrained, or replaced without changing ledger, wallet, compliance,
or Execution Authority.

xAI/Grok remains reserved for Chunk 103.

## What it implements

- `S3mInferenceProvider` satisfying `AiInferenceProvider`
- Configurable transport contract and local simulator
- Normalization into `AiInferenceResponse`
- Health, timeout, bounded retry, and circuit-breaker behavior
- Safety events for prohibited tool requests
- `S3M_PRIMARY` / `S3M_ONLY` fail-closed routing
- Model-registry binding `mdl_sunrey_s3m@s3m-sim-v1`

## What it does not do

- Sign, approve, execute, mint, or issue Execution Authority
- Hold wallet master keys
- Override Kernel, risk, or jurisdiction
- Implement Grok networking
- Invent undocumented S3M API routes
- Claim real-world model performance
