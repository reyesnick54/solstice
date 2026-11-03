# AAFV2.3 — Point-in-time dataset compiler

Adaptive Alpha Fabric V2.3 introduces the **only approved path** for Strategy Lab and Strategy Genome historical feature datasets. All compilation flows through `PointInTimeDatasetCompiler.compileDataset`.

## Primary operation

```typescript
compileDataset({
  universe,
  decisionTimes,
  featureDefinitions,
  strategyGenomeId,
  informationTimePolicy,
});
```

For every decision time `T`, features are eligible only when `knowableAt <= T`.

## Temporal joins

- Use explicit **as-of** semantics (`AS_OF_KNOWABLE`, `AS_OF_SOURCE_EVENT`).
- Ordinary calendar joins are forbidden when information-time semantics apply.

## Revision-sensitive data

At each decision `T`, the compiler selects the latest revision with `knowableAt <= T`. Today's latest revision is never implied.

## Historical universe

Universe membership is point-in-time. The leakage scanner rejects:

- Survivorship leakage
- Future index membership
- Future ticker mapping
- Future corporate actions

## Manifest

Every compiled dataset seals a `PointInTimeDatasetManifest` containing:

- `datasetId`, `strategyGenomeId`, `compilerVersion`
- Decision-time range, universe definition/version, entity graph version
- Feature definitions/versions, observation refs, revision refs
- Source providers, quality policies, entitlement state, transform versions
- `contentHash` (manifest hash) for full reproduction

## Leakage scanner

Canonical AAFV2.3 codes:

| Code | Meaning |
|------|---------|
| `FEATURE_AFTER_DECISION` | Feature value not knowable at T |
| `FILING_AFTER_DECISION` | Filing published after T |
| `REVISION_AFTER_DECISION` | Restatement/revision not knowable at T |
| `ENTITY_MAPPING_AFTER_DECISION` | Identifier mapping learned after T |
| `UNIVERSE_MEMBERSHIP_LEAK` | Index membership not knowable at T |
| `CORPORATE_ACTION_LEAK` | Corporate action after T |
| `MACRO_RELEASE_LEAK` | Macro release/revision after T |
| `ALTERNATIVE_DATA_LEAK` | Alt-data not provider-knowable at T |
| `SOURCE_ARRIVAL_LEAK` | Provider payload arrived after T |

## Strategy Lab integration

- Evaluation APIs accept `PointInTimeDatasetManifest` via the existing seam (`point-in-time-feature-fabric-seam.ts`).
- New Strategy Genome evaluations must pass `requireCompiledPointInTimeDataset` (see `point-in-time-dataset-policy.ts`).
- M09–M12 capsule harnesses may use `legacyCapsuleEvaluationDatasetAdapter` for bar manifests while attaching a parallel PIT manifest for features.

## Qualification

```bash
npm run helios:aafv2-03:point-in-time:qualify
node --test tests/helios-aafv2-03-point-in-time-compiler.test.ts
```

Qualified marker: `HELIOS_AAFV2_03_POINT_IN_TIME_COMPILER_QUALIFIED`.

## Layout

- `packages/platform/src/helios/feature-fabric/compiler/dataset-compiler.ts` — compiler class
- `packages/platform/src/helios/feature-fabric/compiler/leakage-scanner.ts` — explicit scanner
- `packages/platform/src/helios/feature-fabric/compiler/v2-manifest.ts` — reproducible manifest seal
