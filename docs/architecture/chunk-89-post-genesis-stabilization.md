# Chunk 89 — SunRey post-genesis stabilization

Owner: `packages/sunrey-chain/src/post-genesis`.

Capability `sunrey-post-genesis-stabilization` is `IMPLEMENTED`.

This is the operational control plane for the first blocks and epochs
after a future authorized production genesis. Automated tests use
rehearsal networks. This assignment does not activate real production
capabilities.

`realProductionCapabilitiesActivated=false`.

Do not create `packages/post-genesis`, `packages/sunrey-post-genesis`,
`packages/stabilization`, `packages/capability-activation`, or
`packages/production-activation`.
