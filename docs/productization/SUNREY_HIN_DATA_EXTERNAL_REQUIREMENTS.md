# SunRey HIN / Personal Data Vault external requirements

Phase H separates **internal software complete** from **external input
required**. Simulation code being present is not production
authorization.

`LIVE_INFORMATION_RIGHTS_MARKETPLACE=false`
`LIVE_DATA_MONETIZATION_ENABLED=false`
`LIVE_HIN_BASED_ISSUANCE_ENABLED=false`
`LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED=false`

## INTERNAL SOFTWARE COMPLETE

These exist in-repository as simulation / sandbox productization:

- Personal Data Vault (subject-bound encryption, provenance, access audit)
- Consent engine (granular grant, receipt, revoke)
- Data-rights workflows (access, export, correction, deletion, restriction, withdrawal)
- HIN participation and information-rights engine
- Human Contribution Registry and versioned valuation
- Sandbox information-rights licensing, usage metering, compensation instructions
- Kernel-gated fiat compensation path (simulation ledger journals)
- MoonRey productive observation ingest (energy, compute, manufacturing)
- Oracle provenance / freshness / conflict reporting
- Consumer BFF + public SDK contracts for Lovable
- Agent tools that cannot revoke or mint on their own
- Machine-readable production and marketplace gates that remain unsatisfied

## EXTERNAL INPUT REQUIRED

None of the following are satisfied by placeholders, fixtures, or this
repository's simulation adapters.

### Privacy counsel

- Jurisdictional privacy analysis (UK/EU and any launch corridor)
- Lawful-basis and special-category data review
- Cross-border transfer assessment
- Counsel-approved privacy notice and cookie/tracker position if any UI collects

### Consent / terms

- Customer-facing consent language approval
- HIN participation terms
- Information-rights marketplace terms
- Agent financial-analysis disclosure
- Retention and deletion promises that match implemented technical deletion

### Data-source contracts

- Licensed payroll, transaction, energy, compute, and manufacturing feeds
- Prohibition on scraping remains; contracts must grant a lawful source
- Field-mapping and freshness SLAs from the source owner

### Data licenses

- Rights to aggregate and license derived information products
- Purpose limitation that matches HIN request purposes
- No raw PDV export license

### Data processors

- Executed data-processing agreements
- Sub-processor register
- Sandbox processors are not production processors

### Security audits

- Independent security review
- External penetration test of the consumer and licensee surfaces
- Secret-handling and log-redaction sign-off

### Data governance

- Named operational data-governance staff
- Rights-request operations runbook and staffing
- Incident-response playbook for personal-data events

### Production HSM / KMS

- Production key custody for Vault KEKs and consent HMAC
- `DevelopmentHsmSimulator` is not a launch key

### Economic methodology approvals

- Approved HIN valuation methodology (not the engineering simulation scale)
- Approved compensation methodology
- Approved productive-value methodology
- Approved SunRey / MoonRey governance parameters (Phase G remains the mint)

### Marketplace legal structure

- Entity that can sell information rights
- Payment-institution or commercial payment authorization for compensation
- Tax and consumer-protection treatment of earnings

### Regulatory analysis

- Whether information-rights licensing is a regulated activity in each corridor
- Interaction with financial-promotion and investment rules (HIN value is not a return)
- Travel Rule / AML only where compensation intersects money movement

Until these external inputs exist and the machine-readable gates flip
for documented reasons, production data economic activity stays
disabled.
