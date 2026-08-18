# Requester API

Requester-side foundation for identified accountable organizations
and applications.

## Portal

- submit request
- view eligibility
- fund / authorize compensation
- submit clean-room job
- retrieve approved result
- view usage receipts

CLI: `sunrey-information requester <requesterId>`

## Developer platform

Chunk 94 Human Information scopes are separate from ordinary chain-read
scopes:

- `HUMAN_INFORMATION_READ`
- `HUMAN_INFORMATION_REQUEST`
- `HUMAN_INFORMATION_CLEAN_ROOM`

A developer API key alone cannot grant Human Information access. It
must also satisfy application approval, purpose, consent/right, privacy
policy, and eligibility.

## SDK

`InformationClient` methods:

- `getInformationRights`
- `getInformationRequests`
- `previewInformationConsent`
- `approveInformationConsent`
- `revokeInformationConsent`
- `getInformationUsage`
- `getInformationCompensation`
- `submitInformationRequest`
- `submitCleanRoomComputation`
- `getCleanRoomResult`
