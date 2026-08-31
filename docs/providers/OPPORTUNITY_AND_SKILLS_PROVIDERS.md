# Opportunity and Skills Providers — Wave 6 Prompt 23

## Overview

SunRey's canonical **Opportunity Intelligence** layer integrates free job, career, skills, occupation, and public-intelligence providers from the Wave 0 catalog framework. External job APIs provide **information only** — they do not automatically apply for jobs, send user data, negotiate employment, or disclose private user information.

**Canonical owner:** `packages/external-data/src/wave6/`

## Providers integrated

| Provider ID | Name | Category | Capabilities | Status |
| --- | --- | --- | --- | --- |
| `arbeitnow` | Arbeitnow Job Board API | jobs_skills | job_search, employment_market, career_opportunities | Fixture adapter (simulation) |
| `ai-dev-jobs` | AI Dev Jobs API | jobs_skills | job_search, career_opportunities | Fixture adapter (simulation) |
| `artificial-intelligence-jobs` | Artificial Intelligence Jobs | jobs_skills | job_search, career_opportunities | Fixture adapter (simulation) |
| `freehire` | Freehire Job API | jobs_skills | job_search, employment_market, career_opportunities | Fixture adapter (simulation) |
| `graphql-jobs` | GraphQL Jobs API | jobs_skills | job_search, career_opportunities | Fixture adapter (simulation) |
| `techrole-index` | TechRole Index | jobs_skills | occupations, skills, employment_market, salaries | Fixture adapter (simulation) |
| `open-skills` | Open Skills API | jobs_skills | skills, occupations | Fixture adapter (simulation) |
| `noozra` | Noozra News API | jobs_skills | public_opportunity_data, employment_market | Fixture adapter (simulation) |
| `datacube-ai` | DataCube AI Intelligence | jobs_skills | public_opportunity_data, employment_market | Fixture adapter (simulation) |
| `hackernews` | Hacker News API | jobs_skills | public_opportunity_data, employment_market, career_opportunities | Fixture adapter (simulation) |
| `bluesky-public` | Bluesky Public Feeds | jobs_skills | public_opportunity_data, employment_market | Fixture adapter (simulation) |

**Total:** 11 providers (5 job boards, 2 skills/occupations, 4 public intelligence)

**Production-enabled:** 0 (simulation-only fixture adapters; `ENVIRONMENT=simulation`, all `LIVE_*` flags remain `false`)

**Blocked:** 0

## Job coverage

- Technology, AI/ML, GraphQL, and startup roles from community job boards
- Remote, hybrid, and onsite positions
- Full-time, part-time, contract, freelance, and internship roles
- **Not representative of the entire labor market** — limited to catalog provider coverage

## Geographic coverage

| Region | Providers |
| --- | --- |
| Global | ai-dev-jobs, freehire, graphql-jobs, open-skills, noozra, datacube-ai, hackernews, bluesky-public |
| EU | arbeitnow, artificial-intelligence-jobs |
| US | techrole-index |
| GB | artificial-intelligence-jobs |

## Skills coverage

- Open Skills taxonomy: canonical names, aliases, categories, occupation mappings
- TechRole Index: role-skill associations and demand signals
- High-confidence alias normalization (e.g., JS → JavaScript)
- Ambiguous terms preserved as raw labels

## Compensation semantics

- Source amounts preserved in `sourceAmountMin` / `sourceAmountMax`
- Currency and period explicit (`HOURLY`, `DAILY`, `MONTHLY`, `ANNUAL`, `PROJECT`)
- Classification: `EXPLICIT`, `ESTIMATED`, or `UNKNOWN`
- FX conversion field (`fxConvertedReference`) available for Wave 2 `FxReferenceService` integration; null in simulation
- No conversion without preserving source values

## Freshness

| Status | Meaning |
| --- | --- |
| `ACTIVE` | Posted within 7 days |
| `AGING` | 7–30 days old |
| `STALE` | Over 30 days old |
| `EXPIRED` | Past `expiresAt` |

Stale and expired listings are excluded from recommendations.

## Deduplication

Bounded duplicate detection using employer, title, location, and application URL. Uncertain matches are not merged. All source IDs and provenance preserved in `mergedSourceIds`.

## Grow integration

`buildGrowOpportunityContext()` provides:

- Relevant jobs with relevance scores
- Skill growth opportunities
- Career options with salary context
- Income growth signals from public intelligence

Grow consumes via `sunrey.grow.opportunity-context.v1`. No auto-apply.

## Financial Agent integration

`buildAgentOpportunityEvidence()` enables advisory income growth reasoning:

```
User financial goal → Projected savings gap → OpportunityService → Income/career options → Agent recommendation
```

Structural guards:

- `grantsExecutionAuthority: false`
- `autoApply: false`
- `contactEmployer: false`
- `discloseUserIdentity: false`
- `discloseFinancialPosition: false`

## HIN/PEG permissions

- External job data is **public opportunity data**
- Personal graph links (`PERSON_HAS_SKILL`, `USER_INTERESTED_IN_JOB`) require actual user data and permission
- Sensitive attributes (medical history, DNA, banking history, vault contents) are **never** sent to providers
- `assertNoSensitiveDataInQuery()` enforces query boundaries

## Public-intelligence authority classes

| Class | Providers |
| --- | --- |
| `community_data` | arbeitnow, ai-dev-jobs, artificial-intelligence-jobs, freehire, graphql-jobs, open-skills, hackernews, bluesky-public |
| `derived_data` | techrole-index, noozra, datacube-ai |

Social content and news are **not verified fact** (`verifiedFact: false`).

## Action Center events

| Event type | Description |
| --- | --- |
| `NEW_RELEVANT_JOB` | Relevant job matching user criteria |
| `SKILL_GAP_IDENTIFIED` | Skill gap between user and opportunity |
| `CAREER_OPPORTUNITY` | Career path opportunity |
| `INCOME_GROWTH_OPPORTUNITY` | Income growth advisory signal |

All events have `autoNotify: false`. Notifications require user preference architecture.

## Privacy boundaries

Never sent to external opportunity providers:

- Bank balances
- Health records
- DNA
- Communications
- Vault contents
- Transaction history
- Medical history
- Psychological information

Job search queries use minimum necessary inputs only.

## Architecture

```
External Provider (fixture-backed)
    ↓
OpportunityProvider adapter
    ↓
Normalization (employment, remote, salary, skills)
    ↓
OpportunityService (dedup, freshness, cache, relevance)
    ↓
Integrations (Grow, Agent, World, PEG, Action Center)
    ↓
Consumer BFF (services/api)
```

## API routes

| Route | Description |
| --- | --- |
| `GET /api/v1/opportunities/jobs` | Search jobs |
| `GET /api/v1/opportunities/skills` | Search skills |
| `GET /api/v1/opportunities/occupations` | Search occupations |
| `GET /api/v1/opportunities/intelligence` | Public intelligence observations |
| `GET /api/v1/opportunities/coverage` | Coverage report |
| `GET /api/v1/world/opportunities` | World aggregate snapshot |

## Cache policies

| Data type | TTL |
| --- | --- |
| Job search | 15 minutes |
| Job detail | 30 minutes |
| Skills taxonomy | 24 hours |
| Occupations | 24 hours |
| Market demand | 6 hours |
| Public intelligence | 10 minutes |

## Tests

Run: `node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/wave-6-prompt-23-opportunity-intelligence.test.ts`

## Related documentation

- `docs/providers/FREE_API_MASTER_CATALOG.md`
- `docs/providers/PROVIDER_SDK_ARCHITECTURE.md`
- `config/providers/wave6-opportunity-skills-catalog-entries.yaml`
