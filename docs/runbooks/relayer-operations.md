# Relayer operations

Relayers are isolated processes. They are not SunRey validators.

## Role

- Observe one chain
- Submit header updates, packets, acknowledgements, and timeouts
- Pay required protocol resource fees
- Hold no SunRey validator key
- Hold no governance key
- Cannot forge light-client verification

## Running the development relayer

```
sunrey-relayer run --data-dir /tmp/sunrey-interop-dev
```

Two independent relayers may submit the same update. The second
submission is harmless if the first already verified.

## Adversarial traffic

Modified values, fake proofs, fake headers, and old-packet replays
must fail verification. Honest relayer traffic continues.

## DoS

The node bounds header, proof, and packet size, future-height
updates, duplicates, and packet rate. A relayer that exceeds those
bounds is rejected, not trusted more.
