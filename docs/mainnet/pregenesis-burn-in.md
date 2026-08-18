# Pre-genesis burn-in

Burn-in is a repeatable longer-running shadow qualification workflow.

## Rules

- Do not claim a duration that has not actually executed.
- Record actual start/end UTC metadata when a run is performed.
- Fake elapsed-duration claims without clock metadata are unavailable.
- Qualification may use a block/epoch window, an elapsed-duration
  window, or both. The engineering policy decides the requirement.

## Profiles

| Profile | Use |
| --- | --- |
| `bounded` | Ordinary CI. Block/epoch window only. |
| `extended` | Manual workflow. Records the actual clock window of that run. |

`sunrey-ops pregenesis burn-in --claim-duration` without start/end
metadata is rejected.
