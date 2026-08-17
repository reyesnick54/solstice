# SunRey security invariants

Machine-readable catalog: `packages/sunrey-range/src/invariants.ts`.

These invariants are engineering statements. A held invariant means
the isolated range did not observe a prohibited state transition. It
is not a certification or a marketing claim.

| ID | Owner | Statement |
| --- | --- | --- |
| NO_CONFLICTING_FINALITY | packages/sunrey-chain | A height may finalize at most one block identifier under the same validator set. |
| NO_UNAUTHORIZED_ISSUANCE | packages/sunrey-chain | MoonRey and native assets may issue only through authorized engines. |
| NO_ASSET_CREATION_FROM_SETTLEMENT | packages/sunrey-exchange | Settlement and DVP move reserved units. They do not mint. |
| NO_DOUBLE_SETTLEMENT | packages/sunrey-exchange | A trade or settlement authorization finalizes at most once. |
| NO_DOUBLE_MOONREY_ATTRIBUTION | packages/sunrey-chain | A productive contribution fingerprint authorizes issuance at most once. |
| NO_UNAUTHORIZED_GOVERNANCE | packages/sunrey-chain | Protocol, fee, CryptoSuite, and asset-policy changes require a governed proposal. |
| NO_VALIDATOR_KEY_REUSE | packages/sunrey-chain | A consensus key is live in at most one fenced signer location. |
| NO_RAW_PERSONAL_DATA_EGRESS | packages/sunrey-explorer | Explorer, telemetry, and information-right exports must not emit raw PDV, KYC, or private consent rows. |
| NO_INTEROP_PROOF_BYPASS | packages/sunrey-chain | Headers, finality, and membership proofs are verified. Relayers are untrusted. |
| NO_BLIND_WITHDRAWAL_RESUBMISSION | packages/custody | A timed-out or unknown custody submission cannot be blindly resigned against a new destination. |
| NO_MACHINE_MANDATE_BYPASS | packages/sunrey-chain | Machine spend, capability, and delivery actions beyond an explicit mandate are refused. |
| NO_DUPLICATE_VALIDATOR_REWARD | packages/sunrey-chain | One participation entitlement cannot produce two reward payments. |
| NO_DUPLICATE_VALIDATOR_PENALTY | packages/sunrey-chain | One canonical evidence id cannot execute the same protocol penalty twice. |
| NO_CUSTOMER_ASSET_VALIDATOR_PENALTY | packages/sunrey-chain | Validator economic penalties cannot debit customer wallets, custody, Exchange, fiat ledger, or unrelated machine escrow. |
| UNBOND_DELAY_RESPECTED | packages/sunrey-chain | A validator cannot release a bond before the governed unbonding delay and accountability window elapse. |

A preventive control without an alert is acceptable where the scenario
marks `preventiveOnly: true` (for example some BFT power-boundary
documentation cases).
