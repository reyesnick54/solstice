# Capability activation runbook

Environment: rehearsal / simulation only.

1. List independent capabilities:
   `sunrey-mainnet capability list`.
2. Inspect required evidence:
   `sunrey-mainnet capability evidence <CAPABILITY>`.
3. Verify the package against the active network, chain, release, and
   policy:
   `sunrey-mainnet capability verify <CAPABILITY>`.
4. Activation requires human authority. AI activation is rejected.
   `sunrey-mainnet capability activate <CAPABILITY>`.
5. Apply a bounded restriction when needed:
   `sunrey-mainnet capability restrict <CAPABILITY> <ACTION>`.
6. Review the activation audit:
   `sunrey-mainnet capability history`.

Exchange, custody, fiat, Human Information, productive markets, and
interop each require their own evidence. Chain health is not
authorization.

CI uses the rehearsal environment. This runbook does not activate real
production capabilities.
