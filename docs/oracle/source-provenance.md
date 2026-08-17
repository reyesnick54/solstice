# Source provenance

Every collected observation records:

- provider
- source
- source observation ID
- collection timestamp
- source timestamp
- schema version
- unit
- normalization version
- credential / auth method reference (`secret://…`, never the secret)
- collector version
- content hash

The provenance commitment is the `sourceReferenceCommitment` on the
canonical `OracleObservation`. Consensus verifies the signed
observation. It does not re-fetch the external source.
