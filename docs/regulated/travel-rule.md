# Travel Rule provider port

Chunk 69 extends the Chunk 30R Travel Rule architecture with a
provider-neutral port for:

- counterparty discovery
- required originator and beneficiary data exchange
- message status
- provider transaction reference
- evidence references

Required-by-pack Travel Rule state cannot be ignored. A pending or
failed required message blocks the withdrawal gate.

Encrypted envelopes stay off the public chain. Raw sensitive data is
not placed on SunRey Chain.

Threshold packs remain `RESEARCH_REQUIRED`. Provider delivery is
evidence, not a legal conclusion.
