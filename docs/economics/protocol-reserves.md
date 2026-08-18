# Protocol reserves

Governed reserve classes:

- `NETWORK_SECURITY_RESERVE`
- `VALIDATOR_REWARD_RESERVE`
- `PROTOCOL_OPERATIONS_RESERVE`
- `ECOSYSTEM_PROGRAM_RESERVE`
- `EMERGENCY_PROTOCOL_RESERVE`
- `FEE_TREASURY_RESERVE`
- `OTHER_GOVERNED_RESERVE`

A reserve class is an accounting classification of protocol-owned native
quantity. It is not a bank reserve, deposit-insurance fund, or price peg.

`FEE_TREASURY_RESERVE` receives FeePolicyV2 `PROTOCOL_TREASURY` disposition
directly. `VALIDATOR_REWARD_RESERVE` may fund explicitly governed validator
reward sources. Fee-derived validator rewards continue through canonical
fee/reward accounting and are not double-counted.

Emergency reserve access requires heightened human/governance approval.
Emergency authority cannot rewrite supply, confiscate customer assets,
rollback finality, change monetary policy, or mint.
