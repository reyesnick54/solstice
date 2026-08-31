# Health and HIN Reference Providers (Wave 6 Prompt 22)

Date: 2026-08-31  
Status: **Implemented in simulation**

## Purpose

Wave 6 Prompt 22 integrates eligible free/public health-reference, food, nutrition, healthcare-provider, genetics-reference, clinical-trials, and wellness-related providers into SunRey's **public human-health reference data layer**.

External APIs supply **reference knowledge only**. They do not become user medical records, diagnoses, treatment plans, DNA profiles, psychological profiles, health insurance data, personal HIN attributes, or eligibility determinations.

## Integrated providers

| Provider ID | Classification | Category | Authority class |
| --- | --- | --- | --- |
| `open-food-facts` | PRODUCTION_CANDIDATE | food_nutrition | community_data |
| `usda-fooddata-central` | PRODUCTION_CANDIDATE | food_nutrition | authoritative_official |
| `medlineplus-genetics` | PRODUCTION_CANDIDATE | health | authoritative_official |
| `openfda` | PRODUCTION_CANDIDATE | health | authoritative_official |
| `nppes` | PRODUCTION_CANDIDATE | health | authoritative_official |
| `clinicaltrials-gov` | PRODUCTION_CANDIDATE | health | authoritative_official |
| `nhs-scotland-open-data` | PRODUCTION_CANDIDATE | health | authoritative_official |
| `hdx-health` | SECONDARY_SOURCE | health | research_data |
| `longevity-world-cup` | RESEARCH_ONLY | health | research_data |

**Total integrated:** 9 adapters  
**Production-enabled (simulation):** 7  
**Secondary / research only:** 2 (`hdx-health`, `longevity-world-cup`)

## Reference types

| Type | Model | Providers |
| --- | --- | --- |
| FOOD | `FoodProduct` | open-food-facts, usda-fooddata-central |
| NUTRITION | `NutritionObservation` / embedded in `FoodProduct` | open-food-facts, usda-fooddata-central |
| DRUG | `DrugReference` | openfda |
| MEDICAL_DEVICE | `MedicalDeviceReference` | openfda |
| GENETICS | `GeneticsReference` | medlineplus-genetics |
| CLINICAL_TRIAL | `ClinicalTrialObservation` | clinicaltrials-gov |
| HEALTHCARE_PROVIDER | `HealthcareProviderDirectoryEntry` | nppes |
| PUBLIC_HEALTH | `PublicHealthReference` | nhs-scotland-open-data, hdx-health |
| WELLNESS | `WellnessReference` | longevity-world-cup |

## Nutrition units and basis

All nutrition values carry explicit units (`kcal`, `g`, `mg`, `mcg`, `iu`) and basis (`per_serving`, `per_100g`, `per_100ml`, `per_unit`).

Conversion from `per_100g` to `per_serving` retains:

- `sourceValue` / `sourceBasis`
- `normalizedValue` / `normalizedBasis`
- `conversionMethod`

Incompatible bases are never silently compared.

## Authority differentiation

| Source | Authority | Example |
| --- | --- | --- |
| USDA FoodData Central | `authoritative_official` | Government nutrition reference |
| Open Food Facts | `community_data` | User-contributed product records |
| openFDA / NPPES / ClinicalTrials.gov | `authoritative_official` | U.S. government reference |
| HDX Health | `research_data` | Humanitarian datasets |
| Longevity World Cup | `research_data` | Wellness benchmarks (preview) |

## HIN private vs reference separation

```
HINPrivateData          HINReferenceData
(user-owned)            (public knowledge)
     │                         │
     │    Vault permissions    │
     └──────────┬──────────────┘
                │
         External adapters write
         ONLY to reference layer
```

- `HINReferenceData`: public, non-user-specific, `referenceOnly: true`
- `HINPrivateData`: subject-bound, permission-controlled, sensitive
- Public genetics reference **must not** attach to user DNA without explicit consent and vault policy

## Data classification

All Wave 6 observations carry `PUBLIC_HEALTH_REFERENCE` classification, separate from:

- PHI / medical records
- Genetic data
- Biometric data
- Behavioral profiles
- Private wellness data

## Vault permissions

Combining public reference data with user-specific health data requires:

1. Explicit vault consent
2. HIN policy permission
3. `checkVaultPermissionForCombine` — does not broaden permissions automatically

## Privacy

Provider requests are anonymous/public by default. No transmission of:

- User medical history
- DNA profiles
- Financial account data
- Vault documents
- Private user identity data

## Cache policies

| Capability | TTL |
| --- | ---: |
| food_product | 24h |
| nutrition_government | 7d |
| nutrition_community | 24h |
| drug_reference | 12h |
| recall_enforcement | 6h |
| clinical_trial | 24h |
| provider_directory | 7d |
| genetics_educational | 30d |
| public_health | 24h |
| wellness_reference | 7d |

## Architecture

```
External Provider (fixture in simulation)
    ↓
Wave 6 adapter (packages/sunrey-chain/src/health-reference/adapters)
    ↓
Provider Registry + reliability controls (packages/provider-sdk)
    ↓
FoodProduct / DrugReference / ClinicalTrialObservation / etc.
    ↓
HealthReferenceService
    ↓
Consumer BFF (services/api/src/consumer/health-reference.ts)
    ↓
SunRey Application / World / Agent (reference evidence only)
```

## BFF routes

| Route | Description |
| --- | --- |
| `GET /api/v1/health/reference/foods` | Food product search |
| `GET /api/v1/health/reference/foods/{productId}` | Single food product |
| `GET /api/v1/health/reference/nutrition` | Nutrition facts |
| `GET /api/v1/health/reference/drugs` | Drug reference |
| `GET /api/v1/health/reference/devices` | Medical device reference |
| `GET /api/v1/health/reference/genetics` | Genetics education |
| `GET /api/v1/health/reference/trials` | Clinical trials |
| `GET /api/v1/health/reference/providers` | Healthcare provider directory |
| `GET /api/v1/health/reference/public-health` | Public health datasets |
| `GET /api/v1/health/reference/wellness` | Wellness reference |

All responses include `referenceOnly: true`, `notDiagnosis: true`, `hinLayer: HIN_REFERENCE_DATA`.

## Agent / Grow integration

- Financial Agent may use public health reference for **non-clinical economic reasoning** (e.g., life-sciences sector research, clinical-trial ecosystem)
- Agent evidence carries `inferHealthCondition: false` and `grantsDiagnosis: false`
- No health status inference for investment decisions

## World integration

World may expose aggregate public health and nutrition reference data. User-specific HIN data is never exposed through World.

## Known limitations

- Simulation-only fixture adapters; no live HTTP in `ENVIRONMENT=simulation`
- `longevity-world-cup` blocked for production pending commercial terms review
- `hdx-health` requires per-dataset license review before production activation
- Full 126-provider master catalog remains partial
- No diagnosis engine, medication recommender, or treatment recommender

## Related documentation

- `docs/providers/FREE_API_MASTER_CATALOG.md`
- `docs/productization/PHASE_H_01_PERSONAL_DATA_VAULT.md`
- `config/providers/wave6-health-hin-catalog-entries.yaml`
