# Chunk 165 — Frozen-candidate launch authorization ceremony

This chunk binds the existing production genesis ceremony to one exact
frozen launch candidate and rehearses multi-party offline approval.

It does **not** start validators, write genesis, generate real
production private keys, flip `LIVE_*` flags, connect providers, or
mint.

Canonical owner:

- `packages/sunrey-chain/src/production-ceremony`
- bounded module: `packages/sunrey-chain/src/production-ceremony/launch-candidate`

Capability: `sunrey-production-genesis-ceremony` (extended; no competing
ceremony capability).

## Architecture

```
Frozen Candidate Hash
        ↓
Ceremony Plan
        ↓
Participant Verification
        ↓
Public Key / HSM Evidence
        ↓
Offline Approval Packages
        ↓
Multi-Party Signatures
        ↓
Hash-Chained Transcript
        ↓
Launch Authorization Candidate
```

`mainnetEnabled` remains `false`. `productionActivated` remains
`false`.

## Frozen candidate binding

`ProductionLaunchCeremonyBinding` includes:

- `launchFreezeId` / `launchFreezeHash`
- `mainnetRcHash` / `economicRcHash` / `economicAuthorizationHash`
- `genesisHash` / `validatorSetHash` / `cryptoPolicyHash`
- `externalEvidenceSnapshotHash` / `operatingScopeSnapshotHash` /
  `providerBindingSnapshotHash`
- `sourceCommit`

Any mismatch is `CEREMONY_CANDIDATE_MISMATCH` and aborts. The session
does not recompute a hash and continue. A new freeze, new session, and
new signatures are required.

## Economic vs genesis approvals

Chunk 163 economic-parameter signatures and genesis/launch ceremony
signatures are different statements. An economic signature does not
count as genesis approval unless the signed payload explicitly binds
both hashes.

## Human roles

Required distinct humans:

- `GENESIS_AUTHORITY`
- `PROTOCOL_AUTHORITY`
- `SECURITY_AUTHORITY`
- `RELEASE_AUTHORITY`

AI, automation, and services cannot fill those roles. Independent slots
require distinct public identities unless the deliberate
`allowIndependentRoleOverlap` policy is enabled. The default fixture
uses distinct participants.

Participant records bind participant ID, human actor kind, role, public
identity commitment, public signing descriptor, and approval scope.
Passports and other PII do not enter the transcript.

## Key material and HSM

Private keys never enter the transcript, logs, Evidence Vault, offline
package, or Git repository. Only public keys, fingerprints, HSM
handles, signatures, and attestation digests are recorded.

The existing simulation HSM remains rehearsal-only. Fixture HSM cannot
qualify as real production HSM evidence.

## Offline signing and transcript

The offline payload is structured and hash-bound. Mutable
human-readable text is not the signed meaning. Session A signatures
cannot be imported into session B.

The existing hash-chained transcript records freeze binding, participant
verification, evidence and HSM checks, offline export, signature
import/accept/reject, abort, restart required, and authorization
candidate seal. Sequence numbers are monotonic. Previous-entry hash is
required. Tamper or reorder invalidates the transcript.

## Abort

`CeremonyAbortRecord` captures reason, session ID, last valid
transcript hash, candidate freeze hash, and affected artifacts. Abort
does not delete the transcript, erase signatures, reuse private keys,
or activate anything.

## States

`PLANNED` → `REHEARSAL_READY` → `REHEARSAL_IN_PROGRESS` →
`REHEARSAL_COMPLETE` / `AWAITING_REAL_EXTERNAL_EVIDENCE` /
`AWAITING_REAL_HSM` / `AWAITING_HUMAN_SIGNATURES` /
`LAUNCH_AUTHORIZATION_CANDIDATE` / `ABORTED` / `SUPERSEDED`.

There is no `MAINNET_ACTIVE` state.

`LAUNCH_AUTHORIZATION_CANDIDATE` means the exact candidate has human
launch authorization assembled. It still does not start the network.

The current repository remains `REHEARSAL_COMPLETE`. Fixture signatures
are not real human authorization.

## Demo

`demo:sunrey-launch-authorization-ceremony` runs a dress rehearsal
against a frozen fixture candidate, then changes the freeze hash and
shows rejection.
