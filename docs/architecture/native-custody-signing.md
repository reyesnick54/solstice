# Native custody signing

Owner: `packages/security` (HSM/KMS contract) and `packages/custody`
(institutional signer orchestration). Chain primitives stay in
`packages/sunrey-chain`.

## Provider kinds

| Kind | Implementation state | Notes |
| --- | --- | --- |
| `LOCAL_DEVELOPMENT` | `SIMULATION` | Development HSM simulator |
| `REMOTE_SIGNER` | `SIMULATION` | Same non-exportable handle model, remote label |
| `HSM` | `SIMULATION` | Provider-neutral HSM port + development simulator |
| `KMS` | `SIMULATION` | Provider-neutral KMS port + development simulator |
| `MPC` | `PORT_ONLY` | Interface only. No simulated MPC cryptography |
| `OFFLINE_COLD` | `SIMULATION` | Export unsigned package; import signature |

## HSM/KMS contract

Capable of: generate, policy-gated import, public descriptor, sign
canonical digest, rotate, disable, attestation metadata, provider/key
version, health check.

Private material extraction is unsupported. The TypeScript surface has
no extract/export method. `privateMaterialExportSupported` is `false`.

## CryptoSuite negotiation

Capabilities are explicit:

- `CLASSICAL_SUPPORTED`
- `HYBRID_SUPPORTED`
- `PQ_SUPPORTED`

The development simulator supports classical and hybrid simulation
suites. It does not support production PQ. An unavailable requested
suite fails closed. There is no silent downgrade.

## Preview binding

High-value signing requires a deterministic preview:

source, destination, asset, quantity, fee asset, max fee, nonce,
network, chain, expected state effect.

Signed bytes must match the approved preview exactly. An altered
transaction after approval is rejected.

## Cold packages

Export: unsigned canonical transaction, approval evidence, network,
chain, asset, quantity, fee limits, expiration, transaction hash.

Import: signed canonical transaction, signer descriptor, CryptoSuite,
signature. Byte-for-byte approval binding is verified before submit.
