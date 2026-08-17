# Activation plan

`sunrey-mainnet activation-plan` generates a human-readable and
machine-readable future `ActivationPlan`. Generation is safe while
evidence remains incomplete.

The plan does **not**:

- launch production validators
- publish production genesis
- enable `LIVE_*` services
- migrate customer funds
- open Exchange trading
- enable custody withdrawals

## Sequence

1. Release artifact verification
2. Key ceremony verification
3. Genesis verification
4. Validator configuration
5. Network launch sequence (human-controlled, future)
6. RPC / Explorer availability
7. Observability
8. Incident command
9. Capability-specific enablement

A separate future human-controlled activation procedure is required
before any of those steps may execute.
