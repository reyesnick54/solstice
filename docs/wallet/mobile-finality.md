# Mobile finality

SunRey uses deterministic BFT finality. Mobile UI projections must not
present mempool acceptance as blockchain finality.

`WalletFinalityTracker` maps Chunk 93 `FinalityState` and
`WalletPendingTransaction` state onto a display value:

| Pending / chain state | Display | Finalized |
| --- | --- | --- |
| `MEMPOOL_ACCEPTED` / `IN_MEMPOOL` | `PENDING` | false |
| `SUBMITTED` | `PENDING` | false |
| `FINALIZED` / `FINALIZED` | `FINALIZED` | true |
| `REJECTED` | `REJECTED` | false |

There is no confirmation-count or probabilistic longest-chain UI for
finalized SunRey blocks. Reorg semantics for finalized blocks are not a
mobile confirmation problem.

Pending lifecycle uses canonical transaction identity:

`LOCAL_DRAFT` → `SIGNED_NOT_SUBMITTED` → `SUBMITTED` → `MEMPOOL_ACCEPTED`
→ `FINALIZED`, or `REJECTED` / `EXPIRED` / `SUBMISSION_UNKNOWN`.

Safe RPC retry uses the same canonical transaction ID against Chunk 93
endpoint pools.
