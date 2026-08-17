# Key rotation

Rotation is epoch-based (Chunk 36R). The operator path is:

1. Generate a future consensus key through the provider.
2. Submit `ROTATE_CONSENSUS_KEY`.
3. Wait for governance/protocol validation at the next epoch.
4. Activate the new key.
5. Retire the prior key for new signing.
6. Retain the prior public descriptor for historical verification.

```
sunrey-ops validator rotate
```

The old key cannot sign a new epoch after activation.
