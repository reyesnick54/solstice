# Exchange market access

`MarketAccessDecision` evaluates whether an actor may use a market
family. Inputs may include identity class, jurisdiction, product or
market family, compliance state, professional or institutional
status, consent/rights, listing policy, and risk restrictions.

## Four market families

- `DIGITAL_ASSET`
- `HUMAN_INFORMATION_RIGHT`
- `INTELLIGENCE_COMPUTE`
- `PRODUCTIVE_CAPACITY`

Activation policy may differ by family. No family inherits another
family's regulatory status.

## Human information rights

Production-candidate HIR access remains privacy-default-deny. It
requires explicit consent readiness, purpose policy, privacy review,
legal evidence, and Clean Room readiness. Raw Personal Data Vault
export remains unavailable.

## Listing governance

Production-candidate listing requires instrument technical
validation, risk assessment, market-family policy, security review,
legal/regulatory evidence, and an authorized human listing decision.
AI may prepare analysis. AI cannot provide final regulated listing
authorization.

## Kill switches

Existing Exchange controls are reused with scopes `MARKET`, `ASSET`,
`MARKET_FAMILY`, `ORDER_ENTRY`, `SETTLEMENT`, and `WITHDRAWAL`.
Human or security authority is required.
