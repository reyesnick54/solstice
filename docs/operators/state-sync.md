# State sync

Bootstrap a validator from one of:

- genesis + verified block sync
- a cryptographically verified snapshot + subsequent verified blocks

Do not trust a snapshot provider without verification.

```
sunrey-ops state-sync
```

State sync never imports validator private keys.
