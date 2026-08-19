# Chunk 128 — Provider certification

See [`docs/economics/chunk-128-provider-certification.md`](../economics/chunk-128-provider-certification.md).

Canonical owner remains `packages/sunrey-chain` at
`packages/sunrey-chain/src/oracle/production/certification`.
Capability `sunrey-production-oracles` is extended. Bounded capability
`sunrey-provider-certification` names this admission-control layer.

Do not create `packages/provider-certification`,
`packages/provider-registry`, `packages/oracle-certification`,
`packages/conformance-sandbox`, or a second oracle registry.
