# RC known limitations

Candidate release notes must not hide known limitations.

Chunk 83 accepted findings also flow into this register. Fictional
`TEST_FIXTURE_NOT_EXTERNAL_AUDIT` records never satisfy a real
external-review slot.

When Chunk 62 lands `KnownSecurityLimitations`, the RC loader imports
that register. Until then the candidate carries the explicit set
below and still prints every item in release notes.

| Id | Limitation |
| --- | --- |
| NOT_MAINNET | TESTNET only. Does not activate mainnet or production financial services. |
| TICKERS_NOT_ASSIGNED | Public tickers remain NOT_ASSIGNED. Test units have no monetary value. |
| SIMULATION_ENVIRONMENT | ENVIRONMENT stays simulation. LIVE_* flags stay false. |
| PQC_NOT_QUANTUM_PROOF | Standardized PQ provider is TESTNET_APPROVED only. Not quantum-proof. |
| FORMAL_SUITE_ABSENT | Chunk 61 formal verification is not merged. FORMAL records property/invariant smoke. |
| PERFORMANCE_NOT_CORRECTNESS | Benchmarks are engineering measurements, not correctness. |
| ADVERSARIAL_IN_PROCESS | Range red actors are in-process test doubles. Not legal guilt. |
| RELEASE_AUTHORITY_NOT_EXECUTION | ReleaseAuthority signs artifacts only. |
| NO_PUBLIC_STAKING | Public staking is excluded from this RC. |
| NO_LIVE_HSM | No live HSM/KMS. |
| ENDURANCE_NOT_CLAIMED | Do not claim a multi-day run unless it completed. |

`hiddenFromReleaseNotes` is always `false`.
