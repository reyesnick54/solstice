# Mobile push security

Push tokens are notification routing metadata. They cannot authorize a
wallet, open a sync session, or sign.

## Privacy

Push providers receive a generic title, generic body, and a retrieval
hint. The authenticated app fetches sensitive detail.

Providers must not receive:

- seed phrase
- private key
- KYC payload
- raw personal-data contents
- sensitive account details

## Providers

Provider-neutral ports follow Chunk 91 adapter principles:

- `APNS_COMPATIBLE`
- `FCM_COMPATIBLE`
- `FUTURE`

Local CI uses in-memory mocks. Duplicate `pushId` deliveries are accepted
and marked duplicate.

## Preferences

Users configure categories. Security-critical events (`SECURITY_EVENT`,
`NEW_DEVICE`, `RECOVERY_REQUEST`) may remain on by separate policy.

Prepared categories for later chunks:

- Exchange order / trade settlement (Chunk 99)
- Agent mandate action (Chunk 98)
