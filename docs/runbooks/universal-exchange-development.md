# Universal exchange development runbook

Simulation only. Do not enable `LIVE_EXCHANGE_ENABLED` or
`LIVE_CRYPTO_ENABLED`. Do not connect a live bank, FX source, or
payment provider.

## Commands

```
npm test
npm run demo:sunrey-exchange
npm run demo:universal-exchange
npm run demo:listing-governance
```

Package-local:

```
npm test --workspace @solstice/sunrey-exchange
npm run demo:universal --workspace @solstice/sunrey-exchange
```

CLI surface (no network):

```
sunrey-exchange markets
sunrey-exchange instruments
sunrey-exchange orderbook <marketId>
sunrey-exchange auctions
sunrey-exchange contracts
sunrey-exchange delivery
sunrey-exchange settlement
sunrey-exchange rights
sunrey-exchange capacity
sunrey-exchange compute
sunrey-exchange marketdata <marketId>
sunrey-exchange disputes
sunrey-exchange templates
```

## Adding an instrument

1. Build a typed `ExchangeInstrument` with a family extension.
2. Run `evaluateListingGovernance`. Schema, family, rights, oracle,
   legal-research status, and operational readiness must pass.
3. A human operator calls `listInstrument(..., 'HUMAN_OPERATOR')`.
   AI/agent actors are refused (`AI_CANNOT_APPROVE_LISTING`).
4. Do not auto-list an unreviewed asset.

## Settlement failures

| Code | Meaning |
| --- | --- |
| `ORACLE_CONFLICT` | conflicted/stale fact; ordinary delivery blocked |
| `DELIVERY_MISMATCH` | delivered quantity outside contract terms |
| `CONSENT_REVOKED` | grant revoked before use |
| `RIGHTS_FAILURE` | purpose/rights revalidation failed |
| `SETTLEMENT_FAILURE` | escrow arithmetic not exact |
| `DOUBLE_COUNT_FORBIDDEN` | productive graph already referenced the contract |

Open an exchange dispute reference into the canonical case system.
Do not adjudicate inside the matching engine.

## Privacy

Never log or return raw PDV payloads. Information-right market data
exposes purpose category and authorized output type only.
