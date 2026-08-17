# MoonRey production eligibility

Not every verified fact is eligible for MoonRey issuance.

`ProductionContributionEligibilityPolicy` checks:

- feed eligibility
- provider eligibility (`PRODUCTION_CANDIDATE` with evidence)
- quorum and independent controllers
- quality score
- category
- time window
- contribution lineage

Oracle fact creation never mints MoonRey. The existing productive
contribution → authorization → issuance path remains authoritative.

Development issuance in CI is still development issuance. Public
ticker remains `NOT_ASSIGNED`.
