# Wallet transaction authorization

`WalletTransactionPolicy` decides whether a proposed transaction needs:

- a normal user signature
- additional application authentication
- a second device
- a second human approver
- custody approval
- delayed review
- trusted-destination confirmation

The decision is a function of wallet class and explicit policy, not an
opaque behavioral score.

`SigningIntent` is the human-readable projection bound to the canonical
transaction bytes and hash. Changing destination, quantity, asset, fee
authorization, market, mandate, network, or chain after approval
invalidates the approval.

Spend controls are deterministic quantity limits. They do not change
native supply.
