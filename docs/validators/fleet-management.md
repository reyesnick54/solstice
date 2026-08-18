# Validator fleet management

A `ValidatorFleet` is the operator's inventory of validators, sentries,
and signers. It is not a second validator registry.

## Inventory

- Validators and their operational states
- Sentries (topology only; they cannot sign)
- Signers (public fingerprint, fencing, anti-double-sign watermark)
- Regions, failure domains, cloud/provider
- Software release, artifact digest, protocol version
- `ValidatorFleetHealth`

## Health samples

Height, peer count, consensus participation, missed votes, proposal
duties, state root, disk, CPU/memory, network, signer latency, signer
health, and snapshot status.

## Concentration

`sunrey-ops validator concentration` reports operator, cloud, region,
HSM provider, and network concentration. Different validator IDs do
not automatically imply independent operators.

## Public vs private

The public Explorer may show validator ID, public key, voting power,
public status, bond state, and public accountability evidence.

The private operator platform may additionally show infrastructure
health to the assigned operator only.

```
sunrey-ops validator fleet
sunrey-ops validator health
sunrey-ops validator concentration
```
