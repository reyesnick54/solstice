# Runbook — root-of-trust key compromise

This is an engineering procedure for the ceremony tooling. It is not
a completed production incident and not legal advice.

## Do not erase history

Compromised keys stay in the registry as `COMPROMISED`. Historical
signatures remain verifiable.

## Workflow

1. Record suspected compromise (`RootOfTrustCompromise`).
2. Request provider disable for the handle.
3. Restrict the authority (no new signatures).
4. Run a replacement-key ceremony for the same authority class.
5. File a governance / validator change request as applicable.
6. Seal evidence. Reconcile the active authority set.

Recovery authority cannot be promoted to protocol governance.

Software cannot claim hardware destruction without provider/human
evidence. The state `DESTROYED_PROVIDER_CONFIRMED` requires that
evidence.
