# Solstice agent rules

These rules are enforced by computers in CI, not by memory. If a change
breaks a rule, the build fails. A person must review the paths listed in
CODEOWNERS before those files merge.

## How money and accounts work

1. A person or an AI may *propose* an action. Only the Compliance Kernel
   may *authorize* it. The only thing that may change money or open an
   account is a short-lived signed Execution Authority from that Kernel.
2. An Account cannot be built unless that Execution Authority is passed
   in as an argument. There is no back door, admin switch, or test hook
   that creates an account without one.
3. Ledger journals (the official record of money moving) may be written
   only with a valid Execution Authority, through the ledger's posting
   API. Other files must not push or insert journal lines themselves.
4. An account does not store a balance. A balance is always added up
   from ledger postings at the moment someone asks. Putting a balance
   field on an account is a defect.
5. Growth and balance-read code must not name a blended return, yield
   rate, APY, APR, or similar. Insured deposits, investments, and other
   classes stay separate. A single percentage "return" is forbidden.
6. Money is whole minor units (integer / bigint). Floating-point numbers
   (including `parseFloat` and decimals like `1.50`) are forbidden on
   money paths.

## Simulation

This repository is a banking simulation. Real money and live trading
stay off. Simulation stays on. Flipping those flags fails CI. Changing
them also requires a person to review `config/`.

## Packages and services

Library packages must not import services. Each package must be
extractable on its own. Domain code must not talk to disks, networks, or
databases.

## Evidence

Every yes and every no from the Kernel is sealed in the Evidence Vault.
Refusing an action still produces a record. Approving one does too.

## What CI checks, in order

1. Architectural invariants (the rules above) and an extraction dry-run
2. Deployment posture (simulation flags)
3. Tests, including the Phase 1 exit-criterion test
4. The end-to-end demo
5. A secret scan

Do not skip, reorder, or weaken these stages.
