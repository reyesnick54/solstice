# Replay harness

Every discovered failure should become a permanent fixture.

## Command

```
sunrey-test replay <fixture>
```

npm:

```
npm run sunrey-test -- replay tests/assurance/fixtures/empty-decode.json
```

Rust:

```
cargo run -p sunrey-assurance --bin sunrey-test -- replay tests/assurance/fixtures/fee-differential.json
```

## Fixture schema

```json
{
  "schemaVersion": 1,
  "id": "empty-decode",
  "target": "protocol.decode",
  "seed": 56,
  "profile": "FUZZ_SMOKE",
  "networkId": "net_sunrey_simulation",
  "chainId": "chn_sunrey_simulation",
  "genesisRef": "local-dev",
  "actions": [
    { "kind": "decode", "payload": { "hex": "", "expectOk": false } }
  ],
  "expected": { "ok": true, "stateRoots": [], "rejection": null }
}
```

Supported actions: `decode`, `process`, `differential`, `consensus`.

## Failure artifacts

On failure retain seed, target, minimized input, error, state root if
relevant, source commit, and tool version. Do not retain secrets.
`writeFuzzArtifact` writes JSON under a caller-supplied directory.

## Minimization

Rust `proptest` shrinks failing examples. TypeScript campaigns record
the integer seed so the sequence can be replayed. Checked-in corpus
files are already-minimized hex or JSON cases.

## Promotion

Copy a minimized reproducer into `tests/assurance/corpus/<subsystem>/`
or `tests/assurance/fixtures/`. Do not commit enormous generated
corpora.
