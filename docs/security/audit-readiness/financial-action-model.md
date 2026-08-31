# Financial action security model

## Authority chain

```
User intent → Grow proposal (server-owned, versioned)
           → Human approval (step-up when required)
           → Execution command (contentHash bind, TTL)
           → Pre-execution revalidation
           → Kernel ActionIntent
           → Execution Authority (signed, scoped)
           → Ledger.postJournal / provider execute
```

## Critical properties verified (Wave 6 Prompt 17)

| Property | Enforcement | Test |
| --- | --- | --- |
| Proposal immutable/versioned | supersede creates new version | grow.test.ts |
| User auth bound to exact action | approval records actor + assurance | grow.test.ts |
| Idempotency | commandId from idempotency key | grow.test.ts |
| Provider confirmation | execution state machine | execution.ts |
| No duplicate execution | command idempotency + legal transitions | grow.test.ts |
| Expired authorization rejected | proposal/command TTL | Wave 17 tests |
| Amount modification rejected | new version required; old superseded | grow.test.ts |
| Provider change rejected | revalidation facts | revalidateBeforeExecution |
| Instrument change rejected | financialResource on command from proposal | createExecutionCommand |
| Agent cannot self-approve | recordApproval actorKind gate | grow + Wave 17 |

## Kernel gating

All ledger mutators registered in `scripts/check-kernel-gating.mjs`. No admin skip path.

## Grow-specific rules

- `clientInstructionsTrusted: false` always
- `canExecuteWithoutAuthority: false` in explainability
- No guaranteed-return claims (`no-guaranteed-returns.ts`)
- Money in minor units (bigint), never float

## Evidence

```
npm test -- packages/platform/src/grow/grow.test.ts
npm test -- tests/wave-6-prompt-17-security-assurance.test.ts
npm run gate
```
