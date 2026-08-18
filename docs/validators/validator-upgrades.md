# Validator fleet upgrades

`ValidatorUpgradePlan` orchestrates controlled rolling upgrades.

## Bindings

- release identity
- artifact digest
- protocol version
- upgrade policy (`ROLLING_BFT_SAFE`)
- validator batch
- readiness
- post-upgrade verification

## Rolling batches

A batch is accepted only when the remaining unbatched voting power
still satisfies two-thirds-plus. That keeps BFT availability
assumptions intact.

## Protocol activation

Binary deployment does **not** independently activate protocol rules.
Protocol activation remains a governed height/epoch action on the
canonical upgrade path (Chunks 40/54/79).

## Signer upgrades

Signer upgrades preserve key identity where intended, the
anti-double-sign watermark, fencing, and the audit trail.

```
sunrey-ops validator upgrade
sunrey-ops validator upgrade plan
sunrey-ops validator rotate-key
sunrey-ops validator rotate-key prepare
```
