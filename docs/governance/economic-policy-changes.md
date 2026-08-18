# Economic policy change packages

`EconomicPolicyChangePackage` binds:

- target policy family
- current version and proposed version
- canonical deterministic diff
- activation height or epoch
- formal, stress, simulation, readiness, and qualification evidence
- the economic release-candidate hash
- human approvals

The economic release-candidate hash is computed from the exact formal
report hash, economic stress report hash, qualification report hash, and
release artifact hash. Changing the proposal invalidates those bindings.
A wrong release candidate fails preflight.

Canonical diffs report added, removed, and changed parameters plus
changed authority, caps, formulas, eligibility, and activation
conditions.
