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
| NO_TREASURY_MINT | packages/sunrey-chain | Protocol treasury cannot mint SunRey or MoonRey to fund a budget. |
| NO_TREASURY_DOUBLE_SPEND | packages/sunrey-chain | The same reserved treasury quantity cannot be committed to two disbursements. |
| NO_UNAUTHORIZED_TREASURY_SPEND | packages/sunrey-chain | AI and unauthorized actors cannot approve budgets or authorize treasury transfers. |
| NO_CUSTOMER_ASSET_TREASURY_CLAIM | packages/sunrey-chain | Protocol treasury cannot claim customer wallets, custody, Exchange obligations, machine escrow, or fiat ledger balances. |
| LEDGER_APPEND_ONLY | packages/ledger | Journals are append-only. Corrections are new compensating entries. Event handlers cannot post journals. |
| EXECUTION_AUTHORITY_REQUIRED | packages/permissions | Consequential financial mutation requires a verified Execution Authority. Credentials, AI output, and control-room actions are not authority. |
| KERNEL_CANNOT_BE_BYPASSED | packages/kernel | Provider results, AI proposals, and telemetry cannot inject a Kernel ALLOW or skip Compliance Kernel evaluation. |
| ASSET_SUPPLYBOOK_CANONICAL | packages/sunrey-chain | Provider balances, fixtures, and operational snapshots cannot mutate AssetSupplyBook. Supply equations stay consistent. |
| CHUNK_71_MONETARY_AUTHORITY | packages/sunrey-chain | SunRey and MoonRey issuance may occur only through the Chunk 71 monetary constitution. Production-candidate packages cannot mint. |
| AI_CANNOT_EXECUTE | packages/ai-runtime | Simulated S3M/Grok output remains proposals or text. AI cannot approve payments, sign withdrawals, issue Execution Authority, or override the Kernel. |
| RAW_SECRET_NOT_EXPOSED | packages/security | Credential plane, telemetry, logs, and range evidence must not emit raw secrets, Authorization headers, or secret paths. |
| PII_NOT_PUBLIC_CHAIN | packages/custody | Travel Rule and explorer surfaces must not place raw originator/beneficiary PII on a public chain. |
| ORACLE_CONSENSUS_NO_HTTP | packages/sunrey-chain | Oracle consensus engines consume fixture observations. Connector HTTP is off-consensus and fails closed. |
| REFERENCE_PRICE_NOT_PRODUCTIVE_OUTPUT | packages/sunrey-chain | A reference-price observation cannot become a productive claim or mint authorization. |
| CROSS_ASSET_CUSTODY_ISOLATED | packages/custody | A MoonRey hold cannot be debited as SunRey and a SunRey hold cannot be debited as MoonRey. |
| UNKNOWN_SUBMISSION_NOT_BLINDLY_RETRIED | packages/payments | SUBMISSION_UNKNOWN and lost provider responses require query/reconcile. Blind resubmit is refused. |
| COMPLIANCE_UNAVAILABLE_NOT_CLEAR | packages/kernel | KYC, sanctions, PEP, and AML unavailability or timeout fail closed. FAIL_OPEN_COMPLIANCE is false. |
| CONTROL_ROOM_READ_ONLY | packages/sunrey-chain | Control-room incident actions cannot post journals, mint, disable compliance, rotate funds, approve custody, or flip LIVE flags. |
| PRODUCTION_NOT_ACTIVE | packages/config | ENVIRONMENT stays simulation. Every LIVE_* flag stays false. Fixture parameters cannot authorize production. |
| NO_RAW_SECRET_EXPOSURE | packages/security | Range evidence, logs, and credential handles never reveal raw secrets. |
| NO_CROSS_WORKLOAD_CREDENTIAL_USE | packages/security | A credential bound to one workload or provider domain cannot authorize another. |
| CONNECTOR_FAILS_CLOSED | packages/sunrey-chain | Fixture transports refuse localhost, metadata, link-local, credential-in-URL, redirect escape, and unapproved destinations. No external request is made. |
| TRAVEL_RULE_ACK_IS_NOT_WITHDRAWAL_AUTHORITY | packages/custody | A Travel Rule message acknowledgement cannot authorize a withdrawal or ledger posting. |
| PRIVATE_KEY_EXPORT_FORBIDDEN | packages/custody | HSM/KMS handles are non-exportable. Private-key export attempts fail. |
| NO_FALSE_INDEPENDENT_QUORUM | packages/sunrey-chain | Two feeds with the same controller or upstream do not count as independent quorum members. |
| NO_DIRECT_PROVIDER_MINT | packages/sunrey-chain | An oracle or economic-data provider observation cannot mint SunRey or MoonRey. |
| NO_REFERENCE_PRICE_MINT | packages/sunrey-chain | Reference prices cannot convert into issuance quantities. |
| NO_DUPLICATE_FINANCIAL_CONSEQUENCE | packages/events | Duplicate, replayed, or out-of-order events cannot create a second financial effect. |
| NO_HUMAN_WORTH_SCORING | packages/human-economic-contribution | The SunRey human economic model refuses human-worth, PEVE-as-token, and protected-trait ranking fields. |
| NO_REGULATORY_BYPASS | packages/payments | A provider claiming corridor support cannot override Kernel or SunRey policy that disables the corridor. |

A preventive control without an alert is acceptable where the scenario
marks `preventiveOnly: true` (for example some BFT power-boundary
documentation cases).
