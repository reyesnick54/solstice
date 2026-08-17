# Fuzz and property target inventory

Statuses are engineering coverage, not a verification certificate.

| Subsystem | Target | Status | Notes |
| --- | --- | --- | --- |
| protocol | EnvelopeV1 decode | IMPLEMENTED | TS `decode`, Rust `UnsignedTransaction`/`SignedTransaction` |
| protocol | canonical tx encoding | IMPLEMENTED | encode + one-byte mutation |
| protocol | protobuf unknown fields | IMPLEMENTED | `injectUnknownField` rejected |
| protocol | schema version | IMPLEMENTED | invalid version rejected |
| protocol | authentication descriptors | IMPLEMENTED | security fixtures |
| protocol | signature envelopes | IMPLEMENTED | malleability + downgrade |
| protocol | addresses | IMPLEMENTED | TS parse/encode; Rust `parse_address` |
| protocol | account descriptors | IMPLEMENTED | wallet authorization properties |
| protocol | native asset / fee / governance / validator / oracle / productive / machine / interop payloads | IMPLEMENTED | family decode + corpus |
| block | BlockHeader / BlockBody / roots / validator-set hash / commit cert / evidence / version / param hash | IMPLEMENTED | Rust header decode + consensus cert fuzz |
| consensus | Proposal / Prevote / Precommit / CommitCertificate / VoteSet / RoundState / WAL | IMPLEMENTED | existing + new cargo-fuzz; campaign |
| consensus | invalid/duplicate/wrong H/R/set/network; NIL; <2/3 | IMPLEMENTED | TS model + Rust `VoteSet` |
| consensus | one honest validator no equivocation; no two valid commits; height monotonic; lock preserved | IMPLEMENTED | campaign + harness |
| signer | proposal/prevote/precommit/restart/WAL/remote retry | IMPLEMENTED | `DurableSignerSafety` + Rust store |
| assets | issued − burned = circulating + locked | IMPLEMENTED | TS book + Rust `NativeAssetLedger` |
| fees | actual ≤ max; reserved = charged + released; disposition; no partial apply; overflow; unsupported asset | IMPLEMENTED | `FeeEngine` + Rust `FeeSchedule` |
| wallet | insufficient / duplicate / revoked / historic / mandate / watch-only | IMPLEMENTED | `authorizeAccountAction` + Rust `authorize` |
| oracle | order-independent aggregation; quorum; stale; units; duplicate provider; conflict | IMPLEMENTED | median properties; engine unit tests remain canonical for quorum |
| moonrey | no double issue; fingerprint order; capacity/output/delivery; caps; formula; supply | IMPLEMENTED | formula + fingerprint + supply |
| machine | capability / spend / resource / no validator / escrow / partial / revoke | IMPLEMENTED | `MachineEconomyEngine` |
| exchange | reserved+available+pending; no overfill; no double settle; atomic DVP; cancel remainder | IMPLEMENTED | `tests/assurance/exchange.test.ts` |
| exchange | ineligible / expired right / revoked consent / compute partial | PARTIAL | covered by existing universal-exchange unit tests; smoke does not regenerate every family |
| interop | headers/proofs/connections/channels/packets/acks/timeouts/updates | IMPLEMENTED | `InteropEngine` + Rust ledger invariant |
| differential | fees, mulDiv, formula, fingerprint, median, addresses, fees, quantities | IMPLEMENTED | shared JSON; address payload class encoding is PARTIAL across languages |
| state-root | multi-replica sequences | IMPLEMENTED | economic campaign replicas |
| replay | `sunrey-test replay` | IMPLEMENTED | TS CLI + Rust bin |
| resource exhaustion | oversized / nested / huge counts / future height | IMPLEMENTED | explicit bounds in protocol fuzz |
| formal verification | machine-checked proofs | NOT_APPLICABLE | out of scope |

Property counts (smoke profile, seed 56):

- TypeScript protocol mutations: 48
- TypeScript economic/wallet/oracle/MoonRey cases: 48 each family in the suite
- TypeScript consensus events: 96
- TypeScript economic campaign operations: 256 in the unit test, 512 in CLI smoke
- Rust proptest cases: 32 per property
- Rust economic campaign: 2048 operations
- Differential shared cases: 7 checked-in + 32 generated
