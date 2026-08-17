# SunRey adversarial attack matrix

Engineering test matrix for the isolated Chunk 57 range. Detector output is not legal guilt.

| scenario | subsystem | attack/fault | preventive control | detective control | invariant | recovery | test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BFT-DOUBLE-PROPOSAL | consensus | double proposal | DurableSignerSafety | equivocation evidence + operator alert | NO_CONFLICTING_FINALITY, NO_VALIDATOR_KEY_REUSE | jail / rotate validator | TESTED |
| BFT-DOUBLE-PREVOTE | consensus | double prevote | DurableSignerSafety | equivocation evidence | NO_CONFLICTING_FINALITY, NO_VALIDATOR_KEY_REUSE | jail / rotate validator | TESTED |
| BFT-DOUBLE-PRECOMMIT | consensus | double precommit | DurableSignerSafety | equivocation evidence | NO_CONFLICTING_FINALITY, NO_VALIDATOR_KEY_REUSE | jail / rotate validator | TESTED |
| BFT-VOTE-WITHHOLDING | consensus | vote withholding | 2/3+ quorum | missed-vote metrics | NO_CONFLICTING_FINALITY | rotate if persistent | TESTED |
| BFT-PROPOSAL-WITHHOLDING | consensus | proposal withholding | round timeout / next proposer | finality delay alert | NO_CONFLICTING_FINALITY | next round | TESTED |
| BFT-INVALID-BLOCK | consensus | invalid block proposal | block validation before prevote | invalid proposal rejected | NO_CONFLICTING_FINALITY | honest validators ignore | TESTED |
| BFT-STALE-ROUND | consensus | stale-round voting | height/round watermark | security log | NO_CONFLICTING_FINALITY | ignored | TESTED |
| BFT-WRONG-VALIDATOR-SET | consensus | wrong-validator-set voting | validator-set hash binding | accountability reject | NO_CONFLICTING_FINALITY | ignored | TESTED |
| BFT-POWER-LT-1-3 | consensus | < 1/3 adversarial voting power | BFT 1/3 bound | voting-power metrics | NO_CONFLICTING_FINALITY | safety holds | TESTED |
| BFT-POWER-EQ-1-3 | consensus | exactly 1/3 adversarial voting power | hasOneThirdPlus is strict > 1/3 for stall | voting-power metrics | NO_CONFLICTING_FINALITY | document boundary | TESTED |
| BFT-POWER-GT-1-3 | consensus | > 1/3 adversarial voting power | safety may hold; liveness not guaranteed | finality delay | NO_CONFLICTING_FINALITY | operator incident | TESTED |
| BFT-HONEST-LT-2-3 | consensus | < 2/3 honest available | no independent finality without quorum | quorum unavailable | NO_CONFLICTING_FINALITY | restore availability | TESTED |
| BFT-HONEST-GT-2-3 | consensus | > 2/3 honest available | quorum available | commit metrics | NO_CONFLICTING_FINALITY | liveness holds | TESTED |
| NET-PARTITION | p2p | partition | sentry diversity + peer policy + local-only range | network alerts | NO_CONFLICTING_FINALITY | heal partition / restore peers | TESTED |
| NET-ASYMMETRIC-PARTITION | p2p | asymmetric partition | sentry diversity + peer policy + local-only range | network alerts | NO_CONFLICTING_FINALITY | heal partition / restore peers | TESTED |
| NET-LATENCY | p2p | latency | sentry diversity + peer policy + local-only range | network alerts | NO_CONFLICTING_FINALITY | heal partition / restore peers | TESTED |
| NET-PACKET-DUP | p2p | packet duplication | sentry diversity + peer policy + local-only range | network alerts | NO_CONFLICTING_FINALITY | heal partition / restore peers | TESTED |
| NET-PACKET-REORDER | p2p | packet reorder | sentry diversity + peer policy + local-only range | network alerts | NO_CONFLICTING_FINALITY | heal partition / restore peers | TESTED |
| NET-PACKET-LOSS | p2p | packet loss | sentry diversity + peer policy + local-only range | network alerts | NO_CONFLICTING_FINALITY | heal partition / restore peers | TESTED |
| NET-PEER-ISOLATION | p2p | peer isolation | sentry diversity + peer policy + local-only range | network alerts | NO_CONFLICTING_FINALITY | heal partition / restore peers | TESTED |
| NET-CONNECTION-CHURN | p2p | connection churn | sentry diversity + peer policy + local-only range | network alerts | NO_CONFLICTING_FINALITY | heal partition / restore peers | TESTED |
| NET-ECLIPSE-SENTRY | p2p | eclipse attempt | sentry diversity + peer policy + local-only range | network alerts | NO_CONFLICTING_FINALITY | heal partition / restore peers | TESTED |
| SIGNER-COMPROMISE | remote-signer | leaked development validator signing credential | signer-safety database + fencing | operator alerts | NO_VALIDATOR_KEY_REUSE, NO_CONFLICTING_FINALITY | fence + rotate key | TESTED |
| SIGNER-ROLLBACK | remote-signer | restore stale signer-safety data | monotonic watermark restore | SIGNER_ROLLBACK | NO_VALIDATOR_KEY_REUSE | keep trusted checkpoint | TESTED |
| WALLET-OVER-LIMIT | wallet | over-limit transfer with compromised session key | delegated amount limit | wallet rejection | NO_MACHINE_MANDATE_BYPASS | rotate session key | TESTED |
| WALLET-WRONG-FAMILY | wallet | wrong transaction family | delegated transaction-family allow-list | wallet rejection | NO_MACHINE_MANDATE_BYPASS | none | TESTED |
| WALLET-EXPIRED-DELEGATION | wallet | expired delegation | expirationHeight | wallet rejection | NO_MACHINE_MANDATE_BYPASS | none | TESTED |
| WALLET-WRONG-COUNTERPARTY | wallet | wrong counterparty | allowedCounterparty | wallet rejection | NO_MACHINE_MANDATE_BYPASS | none | TESTED |
| WALLET-RECOVERY | wallet | account recovery after compromise | recovery delay + old key rejection | recovery events | NO_MACHINE_MANDATE_BYPASS | new key after delay | TESTED |
| MULTISIG-DUPLICATE | wallet | duplicate signature counted twice | unique signer set | DUPLICATE_SIGNER | NO_UNAUTHORIZED_GOVERNANCE | none | TESTED |
| MULTISIG-UNAUTHORIZED | wallet | unauthorized signer | authorizedKeyIds | UNAUTHORIZED_SIGNER | NO_UNAUTHORIZED_GOVERNANCE | none | TESTED |
| MULTISIG-FORGED | wallet | one valid + one forged signature | threshold + authorized set | INSUFFICIENT_M_OF_N | NO_UNAUTHORIZED_GOVERNANCE | none | TESTED |
| MULTISIG-STALE-AFTER-ROTATION | wallet | stale signer after rotation | rotated key becomes HISTORICAL | OLD_ROTATED_KEY | NO_UNAUTHORIZED_GOVERNANCE | use new key | TESTED |
| ORACLE-ONE-MALICIOUS | oracle | one malicious source | median + quorum | quality / conflict metrics | NO_UNAUTHORIZED_ISSUANCE | suspend provider | TESTED |
| ORACLE-TWO-COLLUDING | oracle | two colluding sources | spread / conflict policy | conflicted fact | NO_UNAUTHORIZED_ISSUANCE | suspend colluders | TESTED |
| ORACLE-OUTLIER | oracle | outlier values | REJECT_OUTSIDE_SPREAD | conflict metrics | NO_UNAUTHORIZED_ISSUANCE | drop outlier | TESTED |
| ORACLE-STALE-REPLAY | oracle | stale replay | maximumAgeSeconds | stale rejection | NO_UNAUTHORIZED_ISSUANCE | ignore stale | TESTED |
| ORACLE-DUPLICATE-IDENTITY | oracle | duplicate provider identities | provider id + sequence | duplicate sequence | NO_UNAUTHORIZED_ISSUANCE | none | TESTED |
| ORACLE-INVALID-UNIT | oracle | invalid unit | unit registry | unit rejection | NO_UNAUTHORIZED_ISSUANCE | none | TESTED |
| ORACLE-RAPID-SEQUENCE | oracle | rapid sequence manipulation | monotonic sequence | duplicate sequence | NO_UNAUTHORIZED_ISSUANCE | none | TESTED |
| ORACLE-CONCENTRATION | oracle | nominal feeds from one controller | controller metadata warning — not claimed Sybil resistance | concentration warning | NO_UNAUTHORIZED_ISSUANCE | operator review | TESTED |
| MOONREY-DUPLICATE-CLAIM | moonrey | duplicate productive claim | contribution fingerprint | DUPLICATE_CONTRIBUTION | NO_DOUBLE_MOONREY_ATTRIBUTION, NO_UNAUTHORIZED_ISSUANCE | none | TESTED |
| MOONREY-REORDERED-OUTPUT | moonrey | same output under different ordering | canonical fingerprint | DUPLICATE_CONTRIBUTION | NO_DOUBLE_MOONREY_ATTRIBUTION | none | TESTED |
| MOONREY-DUPLICATE-METER | moonrey | same energy through duplicate meters | object + period fingerprint | DUPLICATE_CONTRIBUTION | NO_DOUBLE_MOONREY_ATTRIBUTION | none | TESTED |
| MOONREY-CAPACITY-OUTPUT-DOUBLE | moonrey | capacity + output double-counting | countCapacityAsProduction=false | policy | NO_DOUBLE_MOONREY_ATTRIBUTION | none | TESTED |
| MOONREY-DELIVERY-RECOUNT | moonrey | delivery re-counting | countDeliveryIndependentOfOutput=false | policy | NO_DOUBLE_MOONREY_ATTRIBUTION | none | TESTED |
| MOONREY-STALE-ORACLE | moonrey | stale oracle-based issuance | fact validity window | STALE_ORACLE_FACT | NO_UNAUTHORIZED_ISSUANCE | suspend feed | TESTED |
| MOONREY-CONFLICTED-ORACLE | moonrey | conflicted oracle issuance | conflicted facts cannot issue | CONFLICTED_ORACLE_FACT | NO_UNAUTHORIZED_ISSUANCE | suspend feed | TESTED |
| MOONREY-EPOCH-CAP | moonrey | epoch cap bypass | epoch global cap | EPOCH_GLOBAL_CAP | NO_UNAUTHORIZED_ISSUANCE | none | TESTED |
| MOONREY-CATEGORY-CAP | moonrey | category cap bypass | epoch category cap | EPOCH_CATEGORY_CAP | NO_UNAUTHORIZED_ISSUANCE | none | TESTED |
| MOONREY-CROSS-CATEGORY-DUP | moonrey | cross-category full credit for one event | cross-category event fingerprint | CROSS_CATEGORY_DUPLICATE | NO_DOUBLE_MOONREY_ATTRIBUTION | none | TESTED |
| MOONREY-ORACLE-CONTROLLER-CONC | moonrey | nominally different feeds under one controller | Chunk 68 independence analysis | ORACLE_CONTROLLER_CONCENTRATION | NO_UNAUTHORIZED_ISSUANCE | none | TESTED |
| MOONREY-STALE-REFERENCE | moonrey | stale economic reference factor | canonical VerifiedEconomicFact freshness | REFERENCE_FACT_STALE | NO_UNAUTHORIZED_ISSUANCE | suspend feed | TESTED |
| MOONREY-WRONG-UNIT | moonrey | incompatible raw unit | category-specific normalization | WRONG_UNIT | NO_UNAUTHORIZED_ISSUANCE | none | TESTED |
| MOONREY-MALFORMED-NORM | moonrey | malformed normalization factor | bounded versioned factors | MALFORMED_NORMALIZATION | NO_UNAUTHORIZED_ISSUANCE | none | TESTED |
| MOONREY-POLICY-REPLAY | moonrey | replay superseded policy version | height-activated policy registry | POLICY_REPLAY | NO_UNAUTHORIZED_ISSUANCE | none | TESTED |
| MOONREY-FUTURE-POLICY | moonrey | use future policy before activation height | deterministic activation height | POLICY_NOT_YET_ACTIVE | NO_UNAUTHORIZED_ISSUANCE | none | TESTED |
| GRAPH-TAMPER-REBUILD | productive-graph | alter/delete derived graph | graph is a projection of finalized state | hash mismatch | NO_UNAUTHORIZED_ISSUANCE, NO_DOUBLE_MOONREY_ATTRIBUTION | rebuild from snapshot | TESTED |
| MACHINE-OVERSPEND | machine-economy | machine overspend | spending mandate | SPENDING_LIMIT_EXCEEDED | NO_MACHINE_MANDATE_BYPASS | none | TESTED |
| MACHINE-OUTSIDE-CAPABILITY | machine-economy | purchase outside capability | capability manifest | CAPABILITY_MISSING | NO_MACHINE_MANDATE_BYPASS | none | TESTED |
| MACHINE-SELF-CERTIFY | machine-economy | machine self-certifies high-value delivery | oracle-backed delivery | SELF_REPORT_INSUFFICIENT | NO_MACHINE_MANDATE_BYPASS | none | TESTED |
| MACHINE-METER | machine-economy | meter manipulation | oracle conflict on delivery | ORACLE_CONFLICT | NO_MACHINE_MANDATE_BYPASS | hold escrow | TESTED |
| MACHINE-REVOKED | machine-economy | revoked machine action | revocation | status REVOKED | NO_MACHINE_MANDATE_BYPASS | escrow recovery hold | TESTED |
| MACHINE-ESCROW-DOUBLE | machine-economy | escrow double spend | escrow state machine | ESCROW_UNSAFE_STATE | NO_MACHINE_MANDATE_BYPASS, NO_DOUBLE_SETTLEMENT | none | TESTED |
| MACHINE-CONFLICTED-ORACLE | machine-economy | settlement with conflicted oracle fact | conflicted facts cannot settle | ORACLE_CONFLICT | NO_MACHINE_MANDATE_BYPASS | escrow remains locked | TESTED |
| EXCH-SELF-TRADE | exchange | self trading | detector validation only — not legal guilt | SELF_TRADING candidate | NO_DOUBLE_SETTLEMENT | human review | TESTED |
| EXCH-WASH | exchange | wash-trade pattern | candidate alert | WASH_TRADING_PATTERN | NO_DOUBLE_SETTLEMENT | human review | TESTED |
| EXCH-SPOOF | exchange | spoof-like order placement/cancellation | candidate alert | SPOOFING_CANDIDATE | NO_DOUBLE_SETTLEMENT | none | TESTED |
| EXCH-LAYERING | exchange | layering-like patterns | candidate alert | LAYERING_CANDIDATE | NO_DOUBLE_SETTLEMENT | none | TESTED |
| EXCH-CIRCULAR-CAPACITY | exchange | circular capacity trading | candidate alert | CIRCULAR_TRADING_CANDIDATE | NO_DOUBLE_SETTLEMENT | none | TESTED |
| EXCH-ARTIFICIAL-COMPUTE | exchange | artificial compute/capacity volume | candidate alert | ARTIFICIAL_CAPACITY_CANDIDATE | NO_DOUBLE_SETTLEMENT | none | TESTED |
| EXCH-FABRICATED-INTENT | exchange-settlement | fabricated SettlementIntent | exchange signature | WRONG_AUTHORITY | NO_ASSET_CREATION_FROM_SETTLEMENT, NO_DOUBLE_SETTLEMENT | reconcile positions | TESTED |
| EXCH-REPLAYED-TRADE | exchange-settlement | replayed trade | settlement replay set | SETTLEMENT_REPLAY | NO_DOUBLE_SETTLEMENT | reconcile | TESTED |
| EXCH-REPLAYED-AUTH | exchange-settlement | replayed settlement authorization | nonce + settlement id | SETTLEMENT_REPLAY | NO_DOUBLE_SETTLEMENT | reconcile | TESTED |
| EXCH-INSUFFICIENT-RESERVATION | exchange-settlement | insufficient reservation | atomic DVP | reservation check | NO_ASSET_CREATION_FROM_SETTLEMENT | no partial movement | TESTED |
| EXCH-PARTIAL-MULTILEG | exchange-settlement | partial multi-leg state change | native DVP is atomic | reconciliation | NO_ASSET_CREATION_FROM_SETTLEMENT, NO_DOUBLE_SETTLEMENT | reconcile | TESTED |
| EXCH-SUBMISSION-AMBIGUITY | exchange-settlement | submission ambiguity duplicate | idempotent settlement id | replay / already settled | NO_DOUBLE_SETTLEMENT | reconcile | TESTED |
| INFO-WRONG-PURPOSE | consent | wrong purpose | purpose firewall | PURPOSE_MISMATCH | NO_RAW_PERSONAL_DATA_EGRESS | none | TESTED |
| INFO-EXPIRED-CONSENT | consent | expired consent | permit TTL | PERMIT_EXPIRED | NO_RAW_PERSONAL_DATA_EGRESS | none | TESTED |
| INFO-REVOKED-CONSENT | consent | revoked consent | revocation | NO_ACTIVE_CONSENT | NO_RAW_PERSONAL_DATA_EGRESS | none | TESTED |
| INFO-RAW-ROW-EXPORT | pdv | raw-row export | derived-only operations | export denial | NO_RAW_PERSONAL_DATA_EGRESS | none | TESTED |
| INFO-UNAUTHORIZED-CLEANROOM | clean-room | unauthorized clean-room query | rejectArbitraryQuery | ARBITRARY_SQL_FORBIDDEN | NO_RAW_PERSONAL_DATA_EGRESS | none | TESTED |
| INFO-RECIPIENT-MISMATCH | consent | recipient mismatch | recipient binding | RECIPIENT_MISMATCH | NO_RAW_PERSONAL_DATA_EGRESS | none | TESTED |
| EXPLORER-PDV | explorer | search raw PDV | ExplorerExposurePolicy | field stripped | NO_RAW_PERSONAL_DATA_EGRESS | none | TESTED |
| EXPLORER-KYC | explorer | search KYC | ExplorerExposurePolicy | field stripped | NO_RAW_PERSONAL_DATA_EGRESS | none | TESTED |
| EXPLORER-CONSENT | explorer | search private consent | ExplorerExposurePolicy | field stripped | NO_RAW_PERSONAL_DATA_EGRESS | none | TESTED |
| EXPLORER-HSM | explorer | search HSM metadata | ExplorerExposurePolicy | field stripped | NO_RAW_PERSONAL_DATA_EGRESS | none | TESTED |
| EXPLORER-MACHINE-MANDATE | explorer | search private machine mandate fields | ExplorerExposurePolicy | field stripped | NO_RAW_PERSONAL_DATA_EGRESS, NO_MACHINE_MANDATE_BYPASS | none | TESTED |
| CUSTODY-SINGLE-APPROVER | custody | single-approver bypass of dual control | dual control | state remains AWAITING_APPROVAL | NO_BLIND_WITHDRAWAL_RESUBMISSION | second approver required | TESTED |
| CUSTODY-ALTER-AFTER-APPROVAL | custody | alter transaction after approval | approved preview hash | binding mismatch | NO_BLIND_WITHDRAWAL_RESUBMISSION | security hold | TESTED |
| CUSTODY-DESTINATION-REPLACE | custody | destination replacement | approved destination registry | UNAPPROVED_DESTINATION | NO_BLIND_WITHDRAWAL_RESUBMISSION | hold | TESTED |
| CUSTODY-VELOCITY | custody | withdrawal velocity bypass | tier limits | rejected over-limit | NO_BLIND_WITHDRAWAL_RESUBMISSION | hold | TESTED |
| CUSTODY-REPLAYED-APPROVAL | custody | replayed approval | approval idempotency | duplicate approval | NO_BLIND_WITHDRAWAL_RESUBMISSION | hold | TESTED |
| CUSTODY-BLIND-RESUBMIT | custody | blind resubmission after timeout | unknown submission cannot be blindly resigned | rejected resubmit | NO_BLIND_WITHDRAWAL_RESUBMISSION | hold | TESTED |
| CUSTODY-HSM-EXTRACT | custody | HSM key extraction | HSM simulator has no extract API | method absent | NO_VALIDATOR_KEY_REUSE | none | TESTED |
| GOV-AI-APPROVAL | governance | AI-generated approval | AI_PREPARER cannot propose or vote | governance refusal | NO_UNAUTHORIZED_GOVERNANCE | none | TESTED |
| GOV-FORGED-VOTE | governance | forged governance vote | registered signer public key | unauthorized identity | NO_UNAUTHORIZED_GOVERNANCE | none | TESTED |
| GOV-DUPLICATE-POWER | governance | duplicate voting power | one vote per voterId | power not doubled | NO_UNAUTHORIZED_GOVERNANCE | none | TESTED |
| GOV-CHANGED-PROPOSAL | governance | changed proposal after signatures | votes bind proposalContentHash | hash mismatch | NO_UNAUTHORIZED_GOVERNANCE | none | TESTED |
| GOV-EARLY-ACTIVATION | governance | early activation | minActivationLead | validation failure | NO_UNAUTHORIZED_GOVERNANCE | none | TESTED |
| GOV-BINARY-ONLY | governance | binary-only protocol activation | protocol version changes only via activated plan | readiness / version unchanged | NO_UNAUTHORIZED_GOVERNANCE | none | TESTED |
| GOV-FEE-POLICY | fees | unauthorized fee-policy change | applyFeeGovernance requires activated plan | false return | NO_UNAUTHORIZED_GOVERNANCE | none | TESTED |
| GOV-CRYPTOSUITE | governance | unauthorized CryptoSuite change | known development suites only | validateProposal | NO_UNAUTHORIZED_GOVERNANCE | none | TESTED |
| GOV-ASSET-POLICY | governance | unauthorized asset-policy change | FORBIDDEN_PAYLOAD_KEYS | validateProposal | NO_UNAUTHORIZED_GOVERNANCE | none | TESTED |
| UPGRADE-MALICIOUS-BINARY | upgrade | malicious/incompatible binary | artifact/hash readiness | INCOMPATIBLE_BINARY | NO_UNAUTHORIZED_GOVERNANCE | node cannot activate divergent state | TESTED |
| INTEROP-FAKE-HEADER | interop | fake header | height + parent checks | INVALID_HEADER | NO_INTEROP_PROOF_BYPASS | freeze client | TESTED |
| INTEROP-FAKE-FINALITY | interop | fake finality proof | finality proof length/content | INVALID_FINALITY_PROOF | NO_INTEROP_PROOF_BYPASS | freeze client | TESTED |
| INTEROP-FAKE-MEMBERSHIP | interop | fake membership proof | state root membership | INVALID_MEMBERSHIP_PROOF | NO_INTEROP_PROOF_BYPASS | freeze client | TESTED |
| INTEROP-PACKET-REPLAY | interop | packet replay | replay set | PACKET_REPLAY | NO_INTEROP_PROOF_BYPASS | freeze client | TESTED |
| INTEROP-ACK-REPLAY | interop | ack replay | ack replay set | ACK_REPLAY | NO_INTEROP_PROOF_BYPASS | freeze client | TESTED |
| INTEROP-WRONG-CHAIN | interop | wrong chain | registered external chain id | WRONG_EXTERNAL_CHAIN_ID | NO_INTEROP_PROOF_BYPASS | freeze client | TESTED |
| INTEROP-TIMEOUT | interop | timeout manipulation | timeout is fail-closed; escrow recoverable once | timeout metric | NO_INTEROP_PROOF_BYPASS | recover escrow | TESTED |
| INTEROP-CLIENT-EXPIRATION | interop | client expiration bypass | trusting period | CLIENT_EXPIRED | NO_INTEROP_PROOF_BYPASS | freeze / re-init via governance | TESTED |
| BRIDGE-DUP-RECEIVE | interop | duplicate receive | replay + supply assert | PACKET_REPLAY | NO_INTEROP_PROOF_BYPASS | assertSupply | TESTED |
| BRIDGE-DUP-MINT | interop | duplicate mint/representation | escrow conservation | SUPPLY_INVARIANT_VIOLATED | NO_INTEROP_PROOF_BYPASS | assertSupply | TESTED |
| BRIDGE-TIMEOUT-RECEIVE-RACE | interop | timeout + receive race | recover escrow before recv refuses representRemote | SUPPLY_INVARIANT_VIOLATED | NO_INTEROP_PROOF_BYPASS | conservation holds | TESTED |
| BRIDGE-ACK-TIMEOUT-RACE | interop | ack + timeout race | timeout does not re-credit after representation | SUPPLY_INVARIANT_VIOLATED | NO_INTEROP_PROOF_BYPASS | conservation holds | TESTED |
| API-OVERSIZED | rpc | oversized request | PUBLIC_REQUEST_LIMITS.maximumBodyBytes | OVERSIZED_REQUEST | NO_INTEROP_PROOF_BYPASS | none | TESTED |
| API-BURST | rpc | rapid invalid request burst | RateLimiter | RATE_LIMITED | NO_INTEROP_PROOF_BYPASS | none | TESTED |
| API-INVALID-CURSOR | rpc | invalid cursor | opaque cursor MAC | INVALID_PAGINATION_CURSOR | NO_INTEROP_PROOF_BYPASS | none | TESTED |
| API-FUTURE-HEIGHT | rpc | future-height spam | max_future_height = 2 | FUTURE_HEIGHT_SPAM | NO_CONFLICTING_FINALITY | none | TESTED |
| API-MALFORMED-TX | rpc | malformed signed transaction | signed envelope decode | MALFORMED | NO_INTEROP_PROOF_BYPASS | none | TESTED |
| API-DUPLICATE-SUBMISSION | rpc | duplicate submission | transaction id mempool set | KNOWN / DUPLICATE_SUBMISSION | NO_DOUBLE_SETTLEMENT | none | TESTED |
| COMPOUND-ORACLE-VALIDATOR-EXCHANGE | compound | oracle conflict + validator outage + exchange settlement backlog | fail-closed issuance + atomic DVP + BFT quorum | compound alert | NO_CONFLICTING_FINALITY, NO_UNAUTHORIZED_ISSUANCE, NO_ASSET_CREATION_FROM_SETTLEMENT | suspend oracle, reconcile exchange, wait for validator quorum | TESTED |
| COMPOUND-REGIONAL-SIGNER-RPC | compound | regional outage + signer failover + RPC failure | sentry domains + signer fence + RPC limiter | compound alert | NO_CONFLICTING_FINALITY, NO_VALIDATOR_KEY_REUSE | fence signer, restore domain, RPC backoff | TESTED |
| VECON-EQUIVOCATION-PENALTY | validator-economics | equivocation penalty | valid protocol evidence required | penalty receipt | NO_DUPLICATE_VALIDATOR_PENALTY | tombstone or jail per policy | TESTED |
| VECON-FORGED-EVIDENCE | validator-economics | forged evidence | evidence verification | forged evidence refusal | NO_DUPLICATE_VALIDATOR_PENALTY | none | TESTED |
| VECON-REPLAYED-EVIDENCE | validator-economics | replayed evidence | canonical evidence id | duplicate penalty refusal | NO_DUPLICATE_VALIDATOR_PENALTY | none | TESTED |
| VECON-DUPLICATE-REWARD | validator-economics | duplicate reward | entitlement id | duplicate reward refusal | NO_DUPLICATE_VALIDATOR_REWARD | none | TESTED |
| VECON-DUPLICATE-PENALTY | validator-economics | duplicate penalty | executed evidence set | duplicate penalty refusal | NO_DUPLICATE_VALIDATOR_PENALTY | none | TESTED |
| VECON-CUSTOMER-ASSET-PENALTY | validator-economics | customer-asset penalty attempt | economic account domain isolation | customer debit refusal | NO_CUSTOMER_ASSET_VALIDATOR_PENALTY | none | TESTED |
| VECON-IMMEDIATE-UNBOND | validator-economics | immediate unbond attempt | governed unbonding delay | immediate release refusal | UNBOND_DELAY_RESPECTED | none | TESTED |
| VECON-WRONG-POLICY-VERSION | validator-economics | wrong policy version | epoch-scoped policy version | wrong policy refusal | NO_UNAUTHORIZED_GOVERNANCE | none | TESTED |
| VECON-REWARD-OVERFLOW | validator-economics | reward overflow boundary | checked integer arithmetic | overflow refusal | NO_DUPLICATE_VALIDATOR_REWARD | none | TESTED |
