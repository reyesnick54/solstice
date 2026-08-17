# Sentry topology

```
Internet / broader P2P
        ↓
   sentry nodes
        ↓
  validator node
```

Sentries participate in P2P gossip, relay consensus and network
messages, and shield the validator. They have no consensus voting
key.

## Diversity

A validator deployment profile requires at least two sentries.
Authenticated peer paths must be diverse. A single-sentry
availability dependency is rejected.

## Compromise

A compromised sentry can disrupt gossip. It cannot forge validator
votes. Disconnect the sentry and keep the validator on the remaining
authenticated path. Rotate the sentry P2P key before readmission.
