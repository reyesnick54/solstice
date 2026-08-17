# Information-right market

The information-right market sells **authorized use**, not data.

## Instrument

`InformationUseRightInstrument` fields:

- `right_id`
- subject/cohort reference
- permitted computation/template
- purpose
- recipient eligibility
- duration
- revocation behavior
- clean-room requirement
- output restrictions
- compensation terms
- settlement asset
- consent policy reference

The instrument never embeds a Personal Data Vault payload.

## Consent checkpoints

1. **List / sell** — required consent and rights must be active.
2. **Match** — buyer purpose and recipient class must match the grant.
3. **Delivery** — consent and purpose are revalidated. Revocation
   before use blocks delivery (`CONSENT_REVOKED`).

Wrong purpose is a first-class refusal (`PURPOSE_MISMATCH`).

## Delivery-versus-right

payment + valid right + purpose authorization + clean-room
computation → authorized aggregate output / receipt

Raw row export remains unavailable by default. Clean-room receipts
carry `rawRows: false` and `rawPayload: null`.

## Surveillance

Candidate alerts only:

- unauthorized purpose attempts
- consent mismatch
- repeated denied access

Detectors do not decide lawfulness.
