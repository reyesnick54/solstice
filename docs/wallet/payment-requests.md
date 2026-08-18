# Payment requests

SunRey payment-request encoding is versioned (`v1`).

QR form:

```
sunrey:pay/1?v=1&n=<network>&c=<chain>&r=<recipient>&a=<asset>&q=<qty>&m=<memo>&x=<expiry>
```

Universal-link form:

```
https://wallet.sunrey.test/pay/1?...
```

Fields: network, recipient, asset, optional quantity, memo/reference,
and expiry. Scanning creates a preview, not a signature.

Deep links must validate scheme/domain, environment, action class,
network, chain, and payload signature where applicable. A deep link
cannot automatically sign.
