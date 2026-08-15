# Cards bounded context

Canonical owner: `packages/cards` (facade `services/cards`).

This is a **simulation** card platform. It does not issue a real card,
store a real PAN/CVV, connect to a card network, or claim PCI DSS or
network sponsorship.

## Sensitive-data boundary

Solstice application code uses `ProcessorCardReference` and
`NetworkTokenReference` only. Future live issuing would keep PAN, CVV,
PIN, and track data inside a separately assessed PCI-sensitive processor
boundary. That boundary is not implemented here and is not claimed.

Simulation values are unmistakably synthetic (`sim_tok_`, `sim_ntok_`,
`SIM-CARD`).

## Authorization path

```text
Authenticated processor callback
    → CardAuthorizationRequest
    → AUTHORIZE_CARD_PURCHASE ActionIntent
    → Compliance Kernel / policy / fraud
    → available funds (canonical banking position)
    → card controls
    → CREATE_HOLD through BankingOperationsService
    → processor response
```

The callback verifier cannot create a hold. The processor adapter cannot
post journals or issue Execution Authority.

## Cross-currency

Unsupported card-currency vs transaction-currency authorizations are
refused (`CURRENCY_NOT_SUPPORTED`). This chunk does not invent
card-network FX.
