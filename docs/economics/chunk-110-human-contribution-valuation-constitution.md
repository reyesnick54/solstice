# Chunk 110 — Human Contribution Valuation Constitution & Methodology Registry

Canonical owner: `packages/human-economic-contribution`.

Capability `sunrey-human-contribution-valuation` is `IMPLEMENTED` at
`packages/human-economic-contribution/src/valuation`.

This chunk defines **how a particular verified contribution event may
be valued under a versioned policy**. It does not mint, issue Execution
Authority, compute a SunRey quantity, or score a person.

## PEVE is a different system

PEVE asks:

> How is this person's economic system performing?

Human Contribution Valuation asks:

> What settlement value, if any, should be assigned to THIS PARTICULAR
> verified economic contribution under THIS VERSIONED policy?

Never:

- PEVE points → SunRey
- person score → SunRey
- human worth → SunRey

Do not create `packages/human-valuation-engine`.

## Constitution invariants

```
VALUATION_IS_EVENT_SPECIFIC = true
VALUATION_IS_NOT_HUMAN_WORTH = true
VALUATION_IS_NOT_PEVE = true
VALUATION_IS_NOT_CREDIT_SCORE = true
VALUATION_IS_NOT_SOCIAL_CREDIT = true
VALUATION_DOES_NOT_MINT = true
VALUATION_DOES_NOT_AUTHORIZE_EXECUTION = true
PROTECTED_TRAIT_VALUATION_FORBIDDEN = true
PERSON_LEVEL_DESIRABILITY_MULTIPLIER_FORBIDDEN = true
AI_FINAL_VALUATION_AUTHORITY_FORBIDDEN = true
PRODUCTION_VALUATION_POLICY_CONFIGURED = false
```

## Method taxonomy

Permitted methods are contribution-event methodologies, not person
scores:

- `CONTRACTUAL_COMPENSATION`
- `GOVERNED_FIXED_SCHEDULE`
- `INFORMATION_USAGE_RIGHT_SCHEDULE`
- `PROFESSIONAL_SERVICE_SCHEDULE`
- `CREATOR_ROYALTY_SCHEDULE`
- `RESEARCH_PARTICIPATION_SCHEDULE`
- `COMMUNITY_CONTRIBUTION_SCHEDULE`
- `MARKET_REFERENCE`
- `VERIFIED_OUTCOME_ATTRIBUTION`
- `AUCTION_OR_CLEARING_REFERENCE` (reference methodology only; no live
  market connectivity)

Forbidden methods:

- `AI_SUBJECTIVE_HUMAN_SCORE`
- `PEVE_MULTIPLIER`
- `CREDIT_SCORE_MULTIPLIER`
- `SOCIAL_RANK_MULTIPLIER`
- `NET_WORTH_MULTIPLIER`
- `PROTECTED_TRAIT_MULTIPLIER`
- `OPAQUE_PERSON_REPUTATION_SCORE`

Adding a method never grants automatic valuation eligibility.

## Class → method matrix

Each `ContributionClass` has an explicit allowlist. There is no
universal "value of a human contribution" formula.

`OTHER_GOVERNED_HUMAN_CONTRIBUTION` currently has no permitted methods.
Taxonomy membership is not eligibility.

## Inputs

Allowed inputs are contribution-specific and must be traceable
(source, evidence, observed-at). Examples: verified measurement,
contractual compensation reference, license/royalty reference,
information usage scope, verified use count, service-delivery units,
research participation units, verified outcome attribution,
market/reference-data observation, rights scope, evidence quality,
realization status, jurisdiction policy, economic-event context.

A verified professional credential may establish a fact for a
particular professional contribution. It cannot become a generalized
"more valuable human" multiplier.

Forbidden inputs include protected traits (race, ethnicity, religion,
sex, sexual orientation, political affiliation, disability, medical
condition) and person-ranking signals (PEVE composite, credit score,
social-credit score, human-worth score, wallet balance, net worth,
wealth, account balance, general popularity, opaque reputation, AI
opinion of the person's value).

## Reference value

`ContributionReferenceValue` uses bigint amounts. Value classes are
`CONTRACT_REFERENCE`, `FIAT_REFERENCE`,
`GOVERNED_SETTLEMENT_REFERENCE`, and `NON_MONETARY_REFERENCE_UNIT`.

Every value encodes:

```
isSunReyQuantity: false
isPEVEScore: false
isHumanWorth: false
createsMintAuthority: false
```

No floating-point monetary math.

## Factors

A policy may use contribution-level factors
(`VERIFICATION_QUALITY`, `REALIZATION`, `RIGHTS_SCOPE`, `USAGE_SCOPE`,
`OUTCOME_ATTRIBUTION`, `REFERENCE_MARKET`, `FRESHNESS`,
`CONTRACTUAL_TERM`, `JURISDICTION_POLICY`) with integer basis points
or rational numerator/denominator multipliers.

Forbidden factors: `PERSON_QUALITY`, `PERSON_DESIRABILITY`,
`SOCIAL_STATUS`, `WEALTH`, `DEMOGRAPHIC_VALUE`.

## Policy registry

`HumanContributionValuationPolicy` is versioned. Statuses are
`DEVELOPMENT`, `SIMULATION`, `PRODUCTION_CANDIDATE`, and `SUPERSEDED`.
`productionActivated` is always `false`. No production values are
silently defaulted.

The registry:

- registers policies
- retrieves by policy/version
- resolves an active simulation policy
- preserves superseded policies
- prevents mutation of historical policy
- rejects duplicate policy/version
- hashes policies deterministically

It cannot activate production policy.

## Conflict and review

Multiple available methods are not averaged. Explicit policy
`methodPriority` decides. Contractual settlement may precede a
governed schedule only when the active policy says so. References
that conflict beyond the configured tolerance become
`VALUATION_REVIEW_REQUIRED`.

Review states: `NOT_EVALUATED`, `VALUATION_READY`,
`VALUATION_REVIEW_REQUIRED`, `VALUATION_REJECTED`,
`VALUED_SIMULATION`.

AI cannot activate policy, approve production policy, override
protected-trait rules, authorize settlement, or authorize minting.

## Commands

```
npm run demo:sunrey-human-contribution-valuation-policy
```

The demo prints:

```
PEVE_USED=false
HUMAN_WORTH_SCORE=false
SUNREY_QUANTITY=false
PRODUCTION_VALUATION_ACTIVE=false
```
