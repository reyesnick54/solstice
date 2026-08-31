# AI security boundary

Owners: `packages/ai-runtime`, `packages/sunrey-agent`

## Architecture

- Inference plane only — not Execution Authority, not ledger, not wallet
- `mayExecuteFinancialActions: false` on all provider capabilities
- `mayIssueExecutionAuthority: false`
- AI output is **untrusted input** to backend services

## Threat cases tested

| Case | Mitigation | Test |
| --- | --- | --- |
| Prompt injection | detectDirectInjection / indirect | productization-security.test.ts |
| Malicious provider content | indirect injection on MERCHANT_TEXT | productization-security.test.ts |
| Hidden system policy request | refusal patterns | security.ts |
| Credential exfil request | no keys in context, redaction | ai-runtime types |
| Auth bypass via tool | refuseAdversarialToolCall | productization-security.test.ts |
| Unsupported transaction | tool allowlist | productization-security.test.ts |
| Malformed structured output | schema validation / normalization | s3m adapter |
| Data exfil prompt | conversationLogIsSafe, memory classify | productization-security.test.ts |

## Agent isolation (structural)

1. No `packages/platform` dependency from agent
2. No ledger/kernel in AgentRuntimePorts
3. AgentProposal ≠ ActionIntent; ProposalGate only

## Evidence

```
npm test -- packages/sunrey-agent/src/productization-security.test.ts
npm test -- packages/ai-runtime/src/xai-grok.test.ts
```
