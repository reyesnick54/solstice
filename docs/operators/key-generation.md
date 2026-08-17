# Key generation

```
sunrey-ops validator key-generate
```

Keys are generated through the configured CryptoSuite provider.
Private material remains provider-local. The operator API exports
only public descriptors and an audit receipt:

- key ID
- public key
- purpose (`VALIDATOR_CONSENSUS_SIGNING` for voting keys)
- CryptoSuite
- `privateMaterialExported: false`

Consensus, P2P, governance, and recovery keys stay separated. There
is no universal validator key.
