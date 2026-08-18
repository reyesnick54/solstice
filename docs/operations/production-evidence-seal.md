# Production evidence seal

`ProductionEvidenceSeal` hashes a selected immutable set:

- release
- candidate
- genesis
- launch report (if a real execution exists)
- stabilization report
- provider matrix
- audit state
- configuration baseline
- operator acceptance
- active capability matrix

The seal proves integrity of the included records. It does **not** prove
legal compliance, security perfection, or financial safety.

Tampering with any included hash invalidates the seal.
