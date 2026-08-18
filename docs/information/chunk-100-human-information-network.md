# Chunk 100 — Human Information Network

Production-candidate interfaces for the SunRey Human Information
Network live at `packages/information-market/src/network`.

```
synthetic user
  → information descriptor
  → requester
  → purpose-limited request
  → consent
  → clean-room computation
  → privacy-safe result
  → compensation
  → usage receipt
  → on-chain evidence anchor
  → revocation
```

Demo:

```
npm run demo:sunrey-human-information-network
```

The demo always prints:

- `syntheticData=true`
- `rawPersonalDataExported=false`
- `productionActivated=false`

See also:

- [information-rights.md](./information-rights.md)
- [consent-and-purpose.md](./consent-and-purpose.md)
- [privacy-clean-room.md](./privacy-clean-room.md)
- [information-compensation.md](./information-compensation.md)
- [requester-api.md](./requester-api.md)
- [privacy-threat-model.md](./privacy-threat-model.md)
