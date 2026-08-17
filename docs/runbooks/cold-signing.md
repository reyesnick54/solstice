# Runbook — cold signing

Simulation / development only.

1. Complete human approval and transaction simulation on the online
   control plane.
2. Export the unsigned package: canonical bytes, approval evidence,
   network, chain, asset, quantity, fee limits, expiration, hash.
3. Move the package to an isolated development cold signer. The online
   `OFFLINE_COLD` provider refuses to sign.
4. Sign the approved digest only. Do not edit destination, quantity, or
   fee limits.
5. Import the signature. The control plane verifies byte-for-byte
   binding to the approved preview.
6. Submit once and wait for finalized-chain recognition.

Ordinary database backups must not contain plaintext signing material.
Recovery manifests store handles and encrypted configuration only.
