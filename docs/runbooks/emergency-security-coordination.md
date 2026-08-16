# Emergency security coordination (development)

Conservative development mechanism for severe threats:

- critical crypto break
- critical consensus vulnerability
- supply corruption bug

## What it does

Authenticated `SECURITY_GOVERNANCE_SIGNER` identities may propose and
authorize a halt intent. When active, nodes refuse to produce further
protocol state (`INCOMPATIBLE_PROTOCOL` / emergency halt). The intent
is sealed in the governance audit trail.

## What it must not do

- rewrite finalized history
- mint assets
- bypass the Evidence Vault
- create an admin state-edit backdoor
- change customer ledger authority
- issue MoonRey or mutate SunRey Coin supply

## Trust assumptions

1. Development signers are accountable humans or legal entities whose
   governance keys are distinct from consensus, P2P, and Execution
   Authority keys.
2. A halt is coordination of non-participation. It does not rewrite
   blocks that already finalized.
3. Recovery is a new authorized `UpgradePlan` after the halt is
   cancelled by the same governance policy. There is no operator
   database edit.
4. Legal confidence remains `RESEARCH_REQUIRED`. This is not a
   production kill switch and not counsel-confirmed.

AI cannot authorize emergency coordination.
