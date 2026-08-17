# Implementation-trace conformance

Development and testnet tests can export sanitized logical events for:

- consensus
- asset operations
- Exchange DVP
- MoonRey issuance
- governance
- interop

Events contain no secrets, keys, seeds, or signatures.

The adapter maps each event name onto a formal-model transition and
checks invariants after every admitted step.

**Trace conformance is evidence of alignment; it is not a mathematical
proof that implementation and model are equivalent.**
