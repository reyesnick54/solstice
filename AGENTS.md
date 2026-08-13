# Solstice agent rules

AI or a service may propose an action. The Compliance Kernel decides, using six proofs (Identity, Authority, Jurisdiction, Compliance, Risk, Purpose). Proofs may only get stricter, never looser. Only a signed, short-lived, scoped Execution Authority may change consequential state. Every outcome — yes and no — is sealed in the hash-chained Evidence Vault.

Money is integer minor units. Never floating-point. All timestamps are UTC.

Do not open an account except by calling `openAccount` with a verified Execution Authority. There is no admin path, test hook, or flag that skips this.

Do not write a ledger journal except through `Ledger.postJournal`, which requires an Execution Authority. Do not edit or delete a posting. Corrections are new compensating entries.

Do not store a balance on an Account. Balances are read from the ledger. A customer position is one object that always includes the class breakdown next to the total. Do not add a percentage-return, yield, or growth-rate field.

Do not record a principal deposit, withdrawal, or transfer as growth. Growth is genuine economic improvement only.

Do not change ENVIRONMENT away from simulation. Do not turn on any LIVE_* flag. Do not connect to an external bank or payment provider.

Do not catch a Kernel refusal and proceed anyway. Return the Kernel decision unchanged.

Do not put country-specific regulatory logic in application services. Ask the Kernel.

Human review is required for anything under services/accounts.
