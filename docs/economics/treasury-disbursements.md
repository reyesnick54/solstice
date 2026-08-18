# Treasury disbursements

A `TreasuryDisbursementIntent` binds budget, recipient, asset, quantity,
purpose, policy, expiration, approval, and a transaction content hash.

Changing the recipient or quantity invalidates the authorization.

Approved intents reserve native quantity before final submission. The same
treasury quantity cannot be committed to two disbursements. Cancelled or
expired reservations release unused quantity. They do not burn quantity.

Spending is finalized only through canonical SunRey Blockchain state
transition. An off-chain approval record alone does not move native assets.

Submission uses deterministic transaction identity. Blind duplicate
treasury payments are refused.
