# Merchant Exchange

**Status:** `NOT_TESTED`

There is no canonical `merchant-exchange` service or package in this tree.
The closest persistence surface is `cards.merchant_acceptance` in
`db/customer/migrations/V008__wallet_and_acceptance.sql`.

When a canonical Merchant Exchange flow is implemented (intent creation,
merchant matching, offer submission, ranking, user selection, authorization
preparation), add a benchmark suite here following the Access and Exchange
patterns.

Do not invent benchmark numbers for an unimplemented service.
