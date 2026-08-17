# Validator candidates

`MainnetValidatorCandidateManifest` records public descriptors only.

Fields: validator ID, operator entity/reference, consensus / P2P /
governance public keys, CryptoSuite, HSM/attestation reference, failure
domain, voting power, ceremony contribution hash, approval state.

The rehearsal attaches seven simulated production-candidate validators.
Their fixture labels include `NOT_FOR_PRODUCTION` and are derived from
seeds distinct from testnet keys. A testnet public key is rejected.

## Concentration

The evaluator warns on voting-power, failure-domain, and operator
concentration. It does **not** claim organizational independence.
Simulation operator references are not evidence of independent
organizations.

## HSM

Simulation HSM evidence cannot satisfy a real-provider HSM requirement.
