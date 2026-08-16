# Upgrade readiness runbook (development)

Operators inspect node compatibility before an authorized
`UpgradePlan` reaches its activation height.

```
sunrey-node governance readiness --data-dir /tmp/sunrey-dev
sunrey-node protocol version --data-dir /tmp/sunrey-dev
```

## Statuses

| Status | Meaning |
| --- | --- |
| `READY` | Binary, artifact, codec, suite, and migration are present |
| `INCOMPATIBLE_BINARY` | Target protocol version is not in this binary |
| `MISSING_ARTIFACT` | Release artifact hash is not installed |
| `HASH_MISMATCH` | Manifest hash does not match the plan |
| `UNSUPPORTED_CODEC` | Required codec / schema is absent |
| `UNSUPPORTED_CRYPTO_SUITE` | Required CryptoSuite is absent |
| `STATE_MIGRATION_UNAVAILABLE` | Required migration artifact is absent |

## At activation

If the node is not `READY`, it must return `INCOMPATIBLE_PROTOCOL`
and must not produce a block under the new rules. Do not fall back
to the previous execution engine after the height is finalized.

After installing the missing artifact, sync from finalized state and
rejoin. Remaining honest nodes follow the development BFT threshold
(3 of 4 governance power). This is not production consensus.

## Metrics

`protocol_version`, `pending_upgrade`, `upgrade_activation_height`,
`upgrade_readiness`, `governance_votes_power`,
`governance_required_power`, `module_registry_hash`,
`codec_registry_hash`, `crypto_policy_hash`,
`consensus_params_hash`, `upgrade_activation_success`,
`upgrade_activation_failure`.
