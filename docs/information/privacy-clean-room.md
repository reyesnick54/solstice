# Privacy clean room

Chunk 100 uses the canonical Privacy Clean Room. A
`CleanRoomComputationRequest` binds requester, purpose, input rights,
approved computation, output class, privacy policy, expiry,
compensation, jurisdiction policy, and evidence.

## Approved computation

Computation must come from an allow-listed, versioned code or query
definition. Requesters cannot execute arbitrary code over user data.

The bound computation hash includes:

- code / query version
- container / artifact digest
- input-right descriptors
- privacy policy
- output policy

## Output classes

- `BOOLEAN_ATTESTATION`
- `AGGREGATE_STATISTIC`
- `VERIFIED_ATTRIBUTE`
- `PRIVACY_SAFE_SCORE` (transaction/data purpose, never social worth)
- `MODEL_UPDATE_ARTIFACT`
- `OTHER_APPROVED_OUTPUT`

## Controls

- Configurable minimum cohort size for aggregates
- Query, rate, and output-row bounds
- Cross-query abuse detection
- Versioned privacy-budget policy

Differential privacy is not claimed unless a configured mechanism
actually provides it. The default budget records
`differentialPrivacyClaimed=false`.
