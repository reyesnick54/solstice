# Agent human approval

Approval classes:

- `NO_ADDITIONAL_APPROVAL_WITHIN_MANDATE`
- `MOBILE_CONFIRMATION`
- `SECOND_DEVICE_CONFIRMATION`
- `CUSTODY_APPROVAL`
- `MULTI_PERSON_APPROVAL`

High-risk actions always require a human. Mobile confirmation (Chunk 97)
carries a SigningIntent / AgentProposal summary: action, asset,
quantity, destination or market, fees, mandate, and proposal hash.

Revocation applies to future authorization. Unexecuted pending proposals
become ineligible. A wallet kill control revokes every active
financial-agent mandate for that wallet. That is a wallet authorization
action, not blockchain history rewriting.
