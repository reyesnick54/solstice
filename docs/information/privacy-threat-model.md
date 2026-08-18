# Human Information privacy threat model

These controls support privacy. They do not themselves guarantee legal
compliance.

## Assets

- Personal Data Vault source records (off-chain, never a market delivery)
- Purpose-bound consent grants and rights
- Clean-room computation artifacts and privacy-safe outputs
- Compensation and usage receipts
- On-chain hashes and anchors

## Adversaries

- Requester substituting purpose or impersonating another organization
- Developer key used as if it were Human Information authority
- Agent with only a generic financial mandate
- Repeated or small-cohort queries aimed at re-identification
- Arbitrary clean-room code or output tamper
- Consent replay after revocation
- Uncontrolled scraping / collection

## Controls

- Purpose binding and consent-hash HMAC
- Allow-listed computation and bound computation hash
- `NO_RAW_EXPORT` default
- Minimum cohort, query-rate, and output-row bounds
- Cross-query abuse fingerprints
- Developer scope separation from `CHAIN_READ`
- Explicit `MANAGE_HUMAN_INFORMATION_PREFERENCES` agent mandate
- Emergency restriction that can only narrow access

## Out of scope claims

Engineering completion is not production activation. Formal privacy
mechanisms are not claimed unless configured. No human-worth or social
credit score is produced.
