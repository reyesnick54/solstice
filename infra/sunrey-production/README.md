# SunRey production-candidate infrastructure modules

Provider-neutral OpenTofu/Terraform-style modules and a Helm chart.
No commercial provider is hard-coded as the SunRey architecture.
These modules do not deploy live mainnet.

Chunk 86 extends the module set with plan-first service modules:
network, identity, secrets, storage, compute, validator, sentry, RPC,
Explorer, monitoring, database, backup, oracle, Exchange, custody, and
release. CI validates plans against local/rehearsal fixtures only.
`production_authorized` remains `false`.
