# Signer failover

One consensus key cannot be simultaneously active in two locations.

1. Disable the active validator signer
2. Fence the failed site
3. Activate approved passive infrastructure
4. Confirm exactly one ACTIVE role
5. Confirm signer-safety high-watermark is preserved
6. Confirm no equivocation evidence was generated

A stale signer-safety restore is rejected when it would reduce known
signing history.

```
sunrey-ops validator-fencing val_dev_1
sunrey-ops dr run SIGNER_FAILURE
```
