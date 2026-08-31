# Research, Patents, and AI Economics Providers (Wave 6)

Date: 2026-08-31  
Status: **Simulation / preview**

## Purpose

Wave 6 establishes SunRey's reusable **Knowledge Intelligence layer** in
`packages/external-data/src/wave6/`. External providers supply observations and
reference metadata only. They do not receive decision authority over financial
execution, compliance, medical diagnosis, patent infringement conclusions, or
MoonRey issuance.

## Canonical models

| Model | Role |
| --- | --- |
| `ResearchWork` | Scholarly/regulatory/corporate research metadata |
| `ResearchAuthor` / `ResearchInstitution` | Stable identifiers; no aggressive name-only merge |
| `PatentObservation` | Patent landscape metadata; no infringement conclusions |
| `KnowledgeEntity` | Open-knowledge graph entities with authority metadata |
| `AIModelObservation` | External model metadata for cost/availability research |
| `AIEconomicObservation` | Token/compute/agent economics evidence |
| `HinReferenceObservation` | Public food/nutrition reference — not private HIN data |
| `OpportunityObservation` | Jobs/skills/learning opportunities — no auto-apply |

## Canonical services

| Service | Methods |
| --- | --- |
| `ResearchIntelligenceService` | `searchWorks`, `getWork`, `getAuthor`, `getInstitution`, `findRelatedWorks`, `searchTopics` |
| `PatentIntelligenceService` | `searchPatents`, `getPatent`, `searchInventors`, `searchAssignees`, `searchClassifications`, `findRelatedPatents` |
| `KnowledgeIntelligenceService` | `searchEntities`, `getEntity` |
| `AiEconomicsIntelligenceService` | `getModelObservations`, `getEconomicObservations`, `getModel` |
| `HinReferenceService` | `getPublicReference`, `assertNoPrivatePayload` |
| `OpportunityService` | `searchJobs`, `searchSkills`, `searchOpportunities` |

Domain code should call these services rather than provider-specific adapters.

## Implemented catalog providers (simulation)

| Provider ID | Wave 6 role | Authority |
| --- | --- | --- |
| `sec-edgar` | Corporate/research filings | `authoritative_official` |
| `federal-register` | Regulatory research documents | `authoritative_official` |
| `indian-mandi-prices` | Public food reference (HIN reference layer) | `authoritative_official` |
| `co2-offset` | Environmental research evidence | `community_data` |
| `website-carbon` | Derived research + AI model metadata | `derived_data` |

## Blocked / awaiting master list

| Status | Providers |
| --- | --- |
| **Blocked** | `tilth`, `quandl-nasdaq-data-link` |
| **Awaiting authoritative catalog** | OpenAlex, arXiv, OSF, SHARE, PatentsView, USPTO Open Data, Wikidata, Wikipedia API, Socrata, OpenAFRICA, Teleport, Lowy Asia Power Index, NASA, Google Earth Engine, AI Economics Tools, Statlyte, TensorFeed |

These names appear in Wave 6 planning documents but are **not present** in the
authoritative Wave 0 catalog. They are tracked in coverage audit as
`AWAITING_MASTER_LIST` — not invented into the catalog.

## Authority and privacy boundaries

### HIN / Vault

- Public health/food reference data never becomes private user data automatically.
- User DNA, medical records, and psychological data must not be sent to public providers.
- `HinReferenceService.assertNoPrivatePayload` fails closed on forbidden fields.
- Vault permissions remain authoritative.

### Financial Agent

Flow:

```
External Research → Agent Evidence → Reasoning → Suitability/Compliance → User authorization → Execution
```

- Research, patent, and AI-economics evidence may inform recommendations.
- Evidence never grants Execution Authority.
- Agent cannot submit job applications or share private profiles with job providers.
- Publication/patent activity must not directly trigger trades.

### Model Gateway

- External model metadata is evidence/input only.
- `AIModelObservation.reconfiguresModelGateway` is always `false`.
- Model Gateway policy remains authoritative.

### MoonRey

- AI/compute observations enrich productive-economy analytics context.
- No MoonRey minting, burn changes, or native asset identity changes from external API values.

### Copyright / content

- Store metadata, permitted abstracts, and links — not full copyrighted papers or encyclopedia pages.
- Do not bypass paywalls.

## Cache policies

| Class | TTL (approx.) |
| --- | --- |
| Patent metadata | 7 days |
| Research metadata | 1 day |
| AI model/pricing | 1 hour |
| Knowledge graph | 3 days |
| Open government static | 14 days |
| HIN food reference | 1 day |
| Opportunity listings | 6 hours |

## Consumer integration

| Surface | Bridge |
| --- | --- |
| World | `worldKnowledgeSnapshot` |
| Grow | `growKnowledgeSnapshot` |
| Financial Agent | `agentKnowledgeEvidenceSnapshot` |
| MoonRey | `moonReyAiComputeSnapshot` |
| Model Gateway | `modelGatewayKnowledgeSnapshot` |
| HIN reference | `hinReferenceSnapshot` |
| Action Center | `wave6ActionCenterSignals` ( `autoNotify: false` ) |
| Consumer BFF | `services/api/src/consumer/knowledge-intelligence-adapter.ts` |

## Related files

- `packages/external-data/src/wave6/**`
- `packages/external-data/src/plane.ts`
- `tests/wave-6-prompt-24-knowledge-intelligence.test.ts`
- `docs/providers/WAVE_6_COMPLETION_REPORT.md`
