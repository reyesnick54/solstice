# Wallet recovery

`WalletRecoveryPolicy` may combine:

- a recovery passkey
- a secondary verified device
- a human recovery contact / guardian
- a custody operator process
- time-delayed recovery
- multi-party recovery

A single universal recovery credential is rejected. Guardians approve
recovery only. They do not receive spending rights and cannot view
unnecessary wallet or private information.

Recovery may replace future signing authority. It cannot reverse
finalized transfers or rewrite chain history. Existing authority may
challenge or cancel a pending recovery when the policy allows it.

Rehearsal delays may be short. Production delays remain policy-controlled.
Plaintext seed phrases are not stored in backend systems.
