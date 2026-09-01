# Interop security model

Owner: `packages/sunrey-chain/rust/crates/interop`

## Threat cases (re-run Wave 6 Prompt 17)

| Case | Control | Test |
| --- | --- | --- |
| Malicious relayer | IsolatedRelayer, packet verify | `interop/tests/security.rs` |
| Malicious watcher | light client adapter | security.rs |
| External RPC compromise | header/proof validation | security.rs |
| Replay | packet state keys, nonce | security.rs |
| Wrong source chain | chain ID check | `wrong_external_chain_id_rejected` |
| Message forgery | membership proof | merkle tests |
| Bridge pause | governance action | governance tests |
| Key separation | relayer ≠ validator signer | architecture docs |

## Fail-closed posture

Production interop remains inactive unless separately authorized.
`ENVIRONMENT=simulation`. Development fixtures only in CI.

## Evidence

```bash
cd packages/sunrey-chain/rust && cargo test -p sunrey_interop --test security
```

Recommended extended fuzz: interop packet decode, 12h campaign (not in normal CI).
