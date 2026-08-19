# Chunk 130 — Compute & AI Compute Economic Data Provider Fabric

Canonical owner: `packages/sunrey-chain`.

Implementation: `packages/sunrey-chain/src/oracle/production/provider-families/compute`.

Capability `sunrey-compute-ai-data-fabric` is `IMPLEMENTED` on the
existing `sunrey-production-oracles` owner. It does not create a second
oracle network, a second mint, or a live named-provider integration.

This chunk is the provider-neutral economic metering architecture for:

- general compute
- GPU compute
- AI inference
- AI training
- compute capacity

It does **not** store user prompts, model inputs, model outputs, source
code, or private customer workloads.

No live commercial provider is contacted.

## Source classes

`CLUSTER_SCHEDULER`, `CLOUD_METERING`, `GPU_CLUSTER_TELEMETRY`,
`CPU_CLUSTER_TELEMETRY`, `AI_INFERENCE_GATEWAY`, `AI_TRAINING_METER`,
`CONTAINER_ORCHESTRATOR`, `BATCH_JOB_METER`,
`ACCELERATOR_CAPACITY_INVENTORY`, `EDGE_COMPUTE_METER`.

Named vendors are not required. A scheduler, billing export, and usage
API controlled by the same organization are not three independent
controllers. Chunk 128 independence controls still apply.

## Fact types

Existing facts only:

- `COMPUTE_CAPACITY`
- `COMPUTE_USAGE`
- `AI_INFERENCE_USAGE`
- `AI_COMPUTE_CAPACITY`
- `AI_TRAINING_USAGE`

`AI_VALUE`, `AI_INTELLIGENCE_VALUE`, and `MODEL_IMPORTANCE` are refused.

## Resource-time

Wall-clock seconds, CPU-seconds, GPU-seconds, and generic
`compute_s` are not automatically equivalent.

```
1 GPU × 10 seconds = 10 GPU-seconds
8 GPUs × 10 seconds = 80 GPU-seconds
```

Generic `compute_s` requires `resourceClass` (and `resourceCount` when
the quantity is wall duration). Without context the outcome is
`NORMALIZATION_CONTEXT_REQUIRED`. The fabric does not guess CPU or GPU.

GPU-time uses the Chunk 118 exact authority (`gpu_s` / `GPU_HOUR`).
CPU resource-time maps through the canonical CPU context. Source
quantity is preserved. No floating point.

## Tokens are not compute

Inference tokens keep `token_inference` / `TOKEN` with
`INFERENCE_PROCESSED_TOKENS` qualification.

`INPUT_TOKENS`, `OUTPUT_TOKENS`, and `TOTAL_PROCESSED_TOKENS` map to
`token_inference` only when that qualification is explicit.

Training tokens, embedding tokens, prompt tokens, and generated tokens
are not automatically equivalent.

There is no physical conversion `1 token = X GPU seconds`. Token count
and GPU-time are different measurement dimensions. A later Productive
Value Function may compare economic value after governed policy. The
physical normalization system must not.

`AI_TRAINING_USAGE` uses verified resource-time (GPU-seconds or
classified compute-time). Inference tokens cannot silently become
training usage.

## Capacity versus realized use

Installed GPU fleet (`AI_COMPUTE_CAPACITY`) is not
`AI_INFERENCE_USAGE` or `AI_TRAINING_USAGE`. Capacity inventory may
support utilization references. It does not automatically create
productive issuance.

Utilization is actual resource-time / governed capacity resource-time
with compatible dimensions and matching periods. Tokens cannot be
divided by GPU capacity.

## Identity, attribution, and lineage

`ComputeEconomicExecutionReference` is privacy-safe: hashed execution,
job, cluster, pool, and controller refs plus measurement window,
resource class/count, and explicit workload class
(`GENERAL_COMPUTE`, `AI_INFERENCE`, `AI_TRAINING`).

The same execution may appear in cluster telemetry, cloud billing,
container scheduling, GPU telemetry, and an AI gateway. Those are
corroborating sources. Chunk 120 economic-event identity deduplicates
them.

A GPU execution used for AI may produce both `COMPUTE` and
`AI_COMPUTE` views. Chunk 121 attribution prevents two full credits
for the same underlying execution.

Training and inference remain distinct events. Workload class is
never inferred from a provider name.

Compute may reference a verified `ENERGY_CONSUMPTION` fact as input
lineage. It must not claim the power producer's `ENERGY_PRODUCTION`.

## Schemas

Versioned provider-neutral schemas:

- `COMPUTE_USAGE_V1`
- `GPU_USAGE_V1`
- `CPU_USAGE_V1`
- `AI_INFERENCE_USAGE_V1`
- `AI_TRAINING_USAGE_V1`
- `AI_COMPUTE_CAPACITY_V1`

Breaking semantic changes create a new version.

## Certification and registry

Compute provider-family certification fixtures reuse the Chunk 128
suite. Certification is an admission control. It does not finalize an
oracle fact or mint MoonRey.

The Economic Asset Registry stores metadata for compute source
datasets, observation sets, and verified compute facts. Workload
payloads are never stored.

## Demo

```
npm run demo:moonrey-compute-data-fabric
```

Prints:

```
PROMPT_CONTENT_STORED=false
TOKEN_EQUALS_GPU_TIME=false
CAPACITY_EQUALS_REALIZED_OUTPUT=false
REAL_PROVIDER_CONTACTED=false
COMPUTE_FACT_AUTO_MINTS_MOONREY=false
```

Do not create `packages/compute-oracle`,
`packages/ai-compute-provider`, `packages/gpu-metering`, or
`packages/compute-data-fabric`.
