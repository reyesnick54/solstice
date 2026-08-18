# Post-genesis incidents

Operational incident categories:

- `CONSENSUS`
- `SIGNER`
- `STORAGE`
- `DATABASE`
- `ORACLE`
- `ECONOMIC_RECONCILIATION`
- `EXCHANGE`
- `CUSTODY`
- `PROVIDER`
- `SECURITY`
- `GOVERNANCE`

Each incident records checkpoint, component, severity, evidence,
operator action, governance action, current restrictions, and
resolution state.

Conflicting-finality evidence is always a critical `CONSENSUS` incident.

Incident handling cannot rewrite finalized blocks. Corrections occur
through new authorized state transitions or operational recovery
procedures.
