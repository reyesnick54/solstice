# Economic policy freeze

The economic RC freezes exact content hashes for:

| Key | Source |
| --- | --- |
| `sunreyMonetaryPolicy` | Chunk 71 constitution, SunRey Coin |
| `moonreyMonetaryPolicy` | Chunk 71 constitution, MoonRey Coin |
| `validatorBondPolicy` | Chunk 72 bond policy |
| `validatorRewardPolicy` | Chunk 72 reward policy |
| `validatorPenaltyPolicy` | Chunk 72 penalty policy |
| `feePolicyV2` | Chunk 73 `hashFeePolicyV2` |
| `resourceWeightSchedule` | Chunk 73 `hashResourceWeightSchedule` |
| `feeDispositionPolicy` | Chunk 73 `hashFeeDispositionPolicyV2` |
| `moonreyProductivePolicy` | Chunk 74 `hashPolicyBundle` |
| `normalizationRules` | Chunk 74 normalization |
| `issuanceBudgets` | Chunk 74 budget policy |
| `protocolTreasuryPolicy` | Fee disposition treasury sink + `UNCONFIGURED` production budget/disbursement |
| `dualEconomyScenarioSchema` | Chunk 75 scenario schema |

Canonical economic schemas are also frozen. A breaking schema change
requires a new economic RC. Material policy, schema, artifact,
evidence-digest, or qualification-result changes invalidate the
signed bundle and supersede the prior candidate as `SUPERSEDED`.

Production values that have not been approved remain the literal
token `UNCONFIGURED`. The freeze does not invent quantities to make
the qualification matrix look complete.
