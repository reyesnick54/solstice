# Chunk 167 — Launch abort and recovery rehearsal

SunRey already has bounded emergency authority in
`packages/sunrey-chain/src/governance-ops` and operational restriction
controls in `packages/sunrey-chain/src/post-genesis`. Chunk 167 extends
those owners. It does not create a hidden super-admin, a global kill
switch, or a second emergency authority.

## What this chunk answers

If a future launch begins and a serious problem appears:

| Situation | Outcome |
| --- | --- |
| Abort before genesis | `PreGenesisAbortRecord` — no chain history, no genesis block, no balance migration. Candidate freeze, ceremony transcript, reason, and evidence are preserved. |
| Abort during ceremony | Transcript is preserved. Genesis is not created. |
| After finalized genesis | There is no undo-genesis function. |
| Pause / restrict a capability | Domain-scoped `EmergencyActionClass` only. Unrelated safe domains remain available. |
| Application rollback | Approved previous binary/config. `APPLICATION_ROLLBACK_IS_NOT_CHAIN_HISTORY_ROLLBACK=true`. |
| Protocol recovery | Governed upgrade only. `git checkout` cannot rewrite finalized state. |
| Provider / HSM / database / oracle recovery | Existing owners. Restored application DB is not native supply or final chain history. |
| Payment `SUBMISSION_UNKNOWN` | Query / reconcile before retry. Incident pressure cannot authorize blind resubmission. |
| Resume a capability | `CapabilityResumptionCandidate` is independently authorized. Incident end does not auto-resume. |

## Forbidden powers (preserved)

Emergency authority cannot mint, rewrite supply, confiscate, rewrite
finalized blocks, forge oracle facts, erase evidence, rewrite historical
policy, unilaterally approve legal questions, or convert testnet into
mainnet.

Temporary restrictions may expire into `EXPIRED_AWAITING_AUTHORITY`.
Expiry does not resume the capability.

## AI boundary

AI / S3M / Grok may detect, summarize, recommend, and draft. They may
not activate emergency authority, resume a capability, rewrite a
balance, mint, or sign a governance action.

## Owners

- Emergency governance: `packages/sunrey-chain/src/governance-ops`
- Post-genesis restrictions and recovery gates: `packages/sunrey-chain/src/post-genesis`
- Production change / rollback records: `packages/sunrey-chain/src/production-handoff`

Do not create `packages/kill-switch`, `packages/emergency-admin`,
`packages/rollback-engine`, `packages/incident-v2`, or
`packages/recovery-v2`.
