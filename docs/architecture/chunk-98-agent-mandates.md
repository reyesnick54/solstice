# Chunk 98 — User-controlled AI agent mandates

Canonical owner: `packages/sunrey-agent`.

This chunk is the production-candidate architecture that lets a user
authorize an AI agent to perform narrowly bounded financial actions.
It is not a second Personal Economy Agent, Execution Authority issuer,
wallet, Exchange, risk engine, or ledger.

## Authority rule

AI proposes and analyzes by default. Execution is possible only when:

1. A human created an explicit `UserAgentMandate` for a bounded action class
2. The canonical wallet / custody / Execution Authority path accepts the transaction

AI identity alone cannot sign. The agent never receives the user's
unrestricted master key.

## What it implements

- `UserAgent`, `UserAgentMandate`, budgets, asset/market/destination permissions
- `AgentTransactionProposal` and `AgentExecutionRequest`
- Human approval classes, including mobile SigningIntent summaries
- Revocation and wallet-level kill control
- ProposalGate conversion onto existing `ActionIntent` / Compliance Kernel
- Formal model `AGENT_MANDATE_SAFETY`
- CLI `sunrey-agent` and SDK helpers

## What it does not do

- Issue Execution Authority
- Post ledger journals
- Bypass wallet, market, risk, or jurisdiction controls
- Treat simulation performance as production expected returns
- Grant raw Personal Data Vault access from a generic financial mandate
