# STRIDE threat model (Wave 6 Prompt 17)

Engineering analysis. `externalAuditComplete=false` for all entries.
Machine-readable catalog: `packages/security/src/productization/threat-model.ts`.

## STRIDE matrix

| Threat | Representative scenarios | Primary controls | Residual |
| --- | --- | --- | --- |
| **Spoofing** | Fake provider webhook, validator impersonation, merchant API key theft | Webhook HMAC, consensus sig verify, merchant credential rotation | Stolen bearer until expiry |
| **Tampering** | Modified Grow proposal after approval, journal edit, interop packet forge | contentHash bind, append-only ledger, signed packets | Insider with break-glass |
| **Repudiation** | User denies transfer, operator denies admin action | Evidence Vault, auth security events, immutable audit | External log integrity not attested |
| **Information disclosure** | IDOR on accounts, HIN leak in logs, error stack traces | ownership registry, log redaction, error envelope | Misconfigured external SIEM |
| **Denial of service** | Login flood, AI cost abuse, RPC spam | rate limits, endpoint classes, provider circuit breakers | Edge WAF external |
| **Elevation of privilege** | Agent self-approve, client `userId` in body, Kernel bypass | ProposalGate, server-owned authz context, kernel gating CI | Compromised operator credentials |

## Domain-specific threats

| ID | Scenario | Mitigation | Test evidence |
| --- | --- | --- | --- |
| FINANCIAL_FRAUD | Double spend, amount swap | idempotency, revalidation, EA scope | `packages/platform/src/grow/grow.test.ts`, Wave 17 tests |
| ACCOUNT_TAKEOVER | Session theft, refresh replay | refresh family, device revoke, MFA | `authentication-service.test.ts` |
| WALLET_COMPROMISE | Key exfil via API | non-exportable HSM contract, purpose split | `chunk-96-wallet-security.test.ts` |
| VALIDATOR_COMPROMISE | Malicious block | ceremony, purpose matrix, mainnet off | `sunrey-blockchain-threat-model.md` |
| PROVIDER_SPOOFING | Fake bank callback | signature + replay window + env bind | `packages/security/src/regulated/webhook.ts` |
| AI_PROMPT_INJECTION | Tool abuse, policy exfil | injection detect, no EA, cross-user deny | `productization-security.test.ts` |
| SSRF | User URL → metadata | `provider-sdk/ssrf.ts`, webhook inspect | Wave 17 + transport tests |
| SUPPLY_CHAIN | Malicious dependency | lockfiles, secret scan, SBOM | `npm run security:test` |
| MERCHANT_FRAUD | Fake offers | merchant isolation, certification gate | access-economy chaos tests |
| AUTHZ_BYPASS | ID change on URL | ownership registry, orchestrator checks | `authorization.test.ts`, phase-c |
| REPLAY | Refresh/token/command replay | nonce, idempotency keys, TTL | grow + identity tests |
| DOUBLE_EXECUTION | Same approval twice | command idempotency, state machine | `grow/execution.ts` |
| CROSS_CHAIN | Wrong chain message | chain ID bind, light client | `interop/tests/security.rs` |
| INTEROP_RELAYER | Malicious relayer | isolated relayer, governance pause | interop security tests |

## Assets × threats (summary)

High-value assets: Execution Authority, ledger, wallet/validator keys, HIN/PDV, provider credentials.
Highest threat density: financial action path, auth/session layer, provider egress, Agent proposal gate.

## Fuzz / property targets

| Target | Owner | CI | Extended campaign |
| --- | --- | --- | --- |
| Transaction / SRCB decode | `packages/sunrey-chain` | assurance corpus | 24h+ libFuzzer (recommended) |
| PQC hybrid envelope | `packages/sunrey-chain/pqc` | unit + property | 8h structured fuzz |
| Interop packets | `rust/crates/interop` | `security.rs` | 12h cargo fuzz |
| Provider JSON responses | `packages/provider-sdk` | transport tests | 4h mutating fixtures |
| API JSON bodies | `services/api` | Wave 17 malformed tests | DAST against staging |

## Status

Independent threat-model workshop validation remains an external gate.
