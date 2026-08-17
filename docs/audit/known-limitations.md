# Known security limitations

Append-only registry: `packages/sunrey-chain/src/audit/limitations.ts`.

Limitations are included in the reviewer bundle. They are not hidden.

Notable current entries:

| ID | Subsystem | Risk | Status |
| --- | --- | --- | --- |
| LIM-NO-EXTERNAL-AUDIT | audit-readiness | MEDIUM | OPEN |
| LIM-NO-FORMAL-VERIFICATION | assurance | MEDIUM | OPEN |
| LIM-NO-PRODUCTION-HSM | custody | HIGH | OPEN |
| LIM-NO-PRODUCTION-CRYPTO-APPROVAL | cryptography | HIGH | OPEN |
| LIM-NOT-QUANTUM-PROOF | pqc | HIGH | OPEN |
| LIM-DEV-CONSENSUS | consensus | MEDIUM | OPEN |
| LIM-DEV-INTEROP | interoperability | MEDIUM | OPEN |
| LIM-DEV-ECONOMIC-PARAMS | moonrey-issuance | MEDIUM | OPEN |
| LIM-TICKERS-UNASSIGNED | native-assets | LOW | OPEN |
| LIM-ENGINEERING-SLO | operations | LOW | OPEN |
| LIM-NO-LIVE-RAILS | operations | LOW | MITIGATED |

MoonRey and fee parameters in this tree are development/testnet
economic parameters.
