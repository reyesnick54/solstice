# Treasury budget governance

`TreasuryBudgetPolicy` is versioned. It governs allowed reserve classes,
deterministic epoch/height cycles, per-proposal and per-cycle limits,
recipient rules, purpose rules, approval requirements, and activation
boundaries.

A `TreasuryBudget` binds:

- budget ID, policy version, asset, reserve class, purpose
- maximum authorized quantity and cycle
- recipient class, evidence references, governance proposal reference
- approval state

Historical budgets use the policy active for their authorized lifecycle.
Later policy changes cannot silently reinterpret finalized disbursements.

AI may analyze proposals, simulate budget impact, and prepare reports.
AI cannot vote, approve a budget, authorize a transfer, or activate
reserve policy. High-impact production-candidate actions require the
configured human/governance approval model and root-of-trust keys.
