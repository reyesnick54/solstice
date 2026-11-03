# Old AAF PR Supersession Report

## Do not merge

| PR | Branch | Status |
| --- | --- | --- |
| [#579](https://github.com/reyesnick54/solstice/pull/579) | `helios/adaptive-alpha-fabric` | **Obsolete** — superseded by V2 integration on `helios/aaf-v2` |
| [#580](https://github.com/reyesnick54/solstice/pull/580) | `helios-aaf-adaptive-alpha-fabric-merge` | **Obsolete** — CI repair branch merged conceptually into V2.6 |
| [#581](https://github.com/reyesnick54/solstice/pull/581) | `aaf01-current-state-truth-map` | **Obsolete** — truth-map retained as docs only; code rebased through V2.6 |

## Superseded concepts (old AAF01–AAF10 labels)

| Old label | Disposition in V2 |
| --- | --- |
| Optional AAF library | **Mandatory** integrity layer before Strategy Lab promotion |
| AAF06 promotion policy only | Folded into V2.6 `AdaptiveAlphaQualificationPolicy` + Strategy Lab gate |
| Standalone AAF08/AAF09 external planes | Remain under `adaptive-alpha-fabric/` as data planes; certification flows through V2.6 pipeline |
| AAF01 gap register as merge gate | Replaced by V2.6 final qualification marker and CI on `helios/aaf-v2` |

## Rebuilt in V2

- Unified mandatory gate set (`ADAPTIVE_ALPHA_MANDATORY_GATES`)
- `AdaptiveAlphaDatasetCertification` and `AdaptiveAlphaEvidenceBundle`
- Strategy Lab portable qualification ref + promotion store persistence
- End-to-end simulation test (`helios-aaf-v2-strategy-lab-final-qualification.test.ts`)
- OS10 fundamentals coexists with AAF02 fabric via split modules (`fundamental-*` vs core `types.ts`)

## Why old PRs are obsolete

Those PRs attempted to land pre-V2 AAF stacks without Strategy Lab binding, without the V2.6 qualification marker, and with unresolved CI/typecheck debt on unrelated packages. AAF V2.6 integrates the same feature-fabric/compiler/aaf06 surfaces **under a single promotion gate** and current `main` lineage, making the old PR diffs unsafe to merge directly.
