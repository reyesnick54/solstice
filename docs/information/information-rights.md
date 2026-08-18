# Information rights

`HumanInformationRight` is a purpose-limited authorization to perform a
governed use of described information. It is not a transfer of the
person, and it is not a human-worth score.

## Right types

Enumerated types:

- `ONE_TIME_COMPUTATION`
- `RECURRING_COMPUTATION`
- `AGGREGATED_ANALYTICS`
- `MODEL_TRAINING_PERMISSION`
- `MODEL_EVALUATION_PERMISSION`
- `VERIFIED_ATTRIBUTE_QUERY`
- `OTHER_GOVERNED_INFORMATION_RIGHT`

Adding a value to the enum does not enable it. Default production-candidate
policy enables only `ONE_TIME_COMPUTATION`, `AGGREGATED_ANALYTICS`, and
`VERIFIED_ATTRIBUTE_QUERY`.

## Descriptors

`HumanInformationAssetDescriptor` describes category, schema, source
class, freshness, quality/provenance, sensitivity, and permitted
computation classes. It never embeds raw source content.

Highly sensitive categories (`HEALTH_WELLNESS`, `MOBILITY_LOCATION`)
remain default-deny until privacy/legal policy exists.

## Exchange eligibility

Matching uses canonical SunRey Exchange `HUMAN_INFORMATION_RIGHT`
eligibility before any economic match. A match does not deliver raw
Personal Data Vault content.
