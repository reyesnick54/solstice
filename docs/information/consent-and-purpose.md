# Consent and purpose

The network uses the canonical Consent / Purpose Firewall. Chunk 100
binds a `HumanInformationConsentGrant` to:

- subject (privacy-preserving reference)
- information descriptor
- recipient / requester class
- purpose
- processing class
- expiry
- revocation terms
- compensation terms where applicable
- policy version

## Purpose limitation

Every authorized use binds an explicit purpose. Generic
`ANY_FUTURE_PURPOSE` access is rejected.

## Consent is not ownership

Unless a separately defined right says otherwise, consent grants
permission to perform a governed use. Default rights never transfer
ownership.

## Revocation

Future-use revocation is supported. Revocation cannot erase a
legitimately finalized historical settlement or evidence record.

## Preview and receipt

Before approval the subject sees a structured preview: who, category,
purpose, computation, output, duration, frequency, compensation, and
revocation terms. Approval issues a hash-bound consent receipt.
