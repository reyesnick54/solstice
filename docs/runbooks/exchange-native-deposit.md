# Runbook — native-asset exchange deposit

Simulation only. ENVIRONMENT stays `simulation`. No live chain.

## Flow

1. Allocate a custody deposit address for the exchange account
   (`allocateExchangeDepositAddress` / `depositAddress`).
2. Transfer native SunRey Coin or MoonRey Coin to that address.
3. Observe the transaction. Mempool / pending proposal is
   `AWAITING_FINALITY` and does **not** credit the exchange position.
4. Wait for BFT finality (finalized block, not confirmations).
5. Custody recognizes the deposit, maps the address, screens, and
   attributes it to the exchange account.
6. Derived `AVAILABLE` / `FINALIZED` update. No stored account balance.

## Failure

- Unmapped address: reject, do not credit.
- Screening `BLOCK`: reject, open a case.
- Deposit-credit kill switch: reject.
- Kernel refusal: return the decision unchanged.

## Query

Use the exchange API `depositStatus` and custody `getDeposit`.
Reconcile custody holdings against chain finalized state. Do not plug
balances.
