# ADR-0007: Identity and authentication stack

| Field | Value |
| --- | --- |
| Number | 0007 |
| Title | Identity and authentication stack |
| Status | **PROPOSED** |
| Date | 2026-08-13 |
| Deciders | Not yet. This record is a proposal; it is not accepted. |
| Consulted | Security specialist review is **required** before any production use (see §9). |
| Blocking | Yes. Solstice ID cannot be implemented until this decision is accepted. |
| Supersedes | None |
| Superseded by | None |

This is the first Architecture Decision Record in this repository. No prior ADR template exists in-tree (`docs/` was absent at inspection). The format follows [MADR](https://adr.github.io/madr/) adapted for Solstice: status, context, a hard filter, numbered options with consequences, a cross-cutting analysis, evaluation against the platform priority order, a recommendation, and an explicit security-review gate.

**Status vocabulary for this tree:** `PROPOSED` · `ACCEPTED` · `REJECTED` · `SUPERSEDED` · `DEPRECATED`. This record is **PROPOSED**. It must not be treated as ACCEPTED, and it authorizes no implementation, SDK, or vendor contract.

**Compliance disclaimer:** this ADR evaluates architectural fit (data location, key custody, protocol support, exit). It does **not** claim that any provider, product, or topology is compliant with GDPR, UK GDPR, SAMA, Saudi PDPL, UAE PDPL, DIFC, ADGM, FCA, CBUAE, or any other regulation. Fitness for a regulator is a legal and security-specialist determination, not an architectural one.

---

## 1. Context

### 1.1 What exists in this repository today

Inspection of `github.com/reyesnick54/solstice` at `main` (`033b9ef`) and of this working tree found **no identity implementation**. The application tree is:

```
/workspace
└── README.md          # single line: "# solstice"
```

The following were searched and are **NOT PRESENT**:

| Expected location | Result |
| --- | --- |
| `packages/` | Absent. No identity, domain, or permissions package. |
| `services/` | Absent. No identity service, IdP adapter, or KYC service. |
| `docs/` | Absent before this file. No Sovereign Cell design doc, no identity spec, no prior ADRs. |
| `AGENTS.md`, `CODEOWNERS`, `.github/` | Absent. |
| `package.json` / lockfiles / tests | Absent. No test suite exists to describe identity behaviour. |

Repository-wide search for identity-related names (`Identity`, `ActionIntent`, `AuthorizationDecision`, `ExecutionAuthority`, `KYC`, `passkey`, `WebAuthn`, `Sovereign`, `Cell`) returned **no matches** in application files. The only in-repo identity-adjacent string is the README title `solstice`.

**Identity concepts that already exist in code:** none. There are no types, traits, protobufs, or database schemas for legal identity, verification, residency, device trust, MFA, passkeys, risk-based authentication, step-up, or KYC state.

A prior read-only audit of this same revision reached the same conclusion: Phase 0 (Compliance Kernel, proofs, Evidence Vault, ledger) is claimed in the platform brief and is **not in git**.

### 1.2 Claimed architecture this ADR must serve

The platform brief (not yet encoded in this repository) states the control-plane rule:

> AI proposes, a deterministic Compliance Kernel authorizes, a signed short-lived Execution Authority is the only thing the double-entry ledger accepts, and every decision (approval or refusal) is sealed in a hash-chained Evidence Vault.

The permissions model, when it is built, is specified to include:

- `ActionIntent`
- `AuthorizationDecision`
- Six proof classes: **Identity**, Authority, Jurisdiction, Compliance, Risk, Purpose
- Signed short-lived **Execution Authority**
- Agent capability tokens (agents produce proposals only)

**Solstice ID** is the identity foundation in that model. The product scope, as given for this decision, is:

- Legal identity
- Verification
- Residency (binding a person to a Sovereign Cell)
- Device trust
- MFA
- Passkeys / WebAuthn
- Risk-based and step-up authentication
- KYC state with versioning and refresh

Identity is not a login box. It is the first proof the kernel must be able to evaluate before it will sign an Execution Authority that can move value.

### 1.3 What the Identity proof currently checks

**Nothing.** There is no Identity proof implementation, no checker, and no test.

When the permissions package is built, the Identity proof is the kernel input that must attest, for a given `ActionIntent`, at least:

1. **Subject** — a stable, cell-scoped Solstice person (or organisation) identifier, not a vendor `sub`.
2. **Legal identity** — the subject is a known legal person (or legal entity), not an anonymous session.
3. **Authentication assurance** — the current session meets the assurance level the intent requires (including step-up when the intent is higher-risk than the session).
4. **Device trust** — the device is bound and in an acceptable trust state when the intent demands it.
5. **KYC currency** — a versioned KYC state exists, is not expired, and is the version the policy pack named.
6. **Residency** — the subject's home cell matches the cell in which the intent is being evaluated. Identity data used to build the proof did not arrive from another cell.

Those checks are **requirements for a future proof assembler**. They are not present in code. This ADR exists because choosing an identity stack that cannot supply (or cannot be wrapped to supply) those facts will block the kernel.

### 1.4 Why this decision is blocking

ADR-0006 (policy engine language) and ADR-0007 (this record) were named as unresolved in the platform brief and were **absent** from the repository. Without an identity stack decision:

- The Identity proof cannot be typed.
- Device binding, passkeys, and step-up cannot be designed against a real protocol.
- KYC versioning has nowhere to hang.
- A later SaaS choice could silently create a global user directory and violate Sovereign Cells.

---

## 2. Hard filter: Sovereign Cells

**Sovereign Cells are a hard filter, not a preference.**

Solstice will operate independent cells for at least:

| Cell | Region |
| --- | --- |
| `US` | United States |
| `EU` | European Union |
| `SA` | Saudi Arabia |
| `UAE` | United Arab Emirates |
| `UK` | United Kingdom |

**Hard rule:** identity data of a subject whose home cell is `C` must be stored, processed, backed up, logged, and keyed **inside cell `C`**. It must not be written to a single centralized global user directory, a vendor control plane in another region, a global metadata store, or a replica in a sibling cell.

Operational consequences of the filter (all must hold):

1. **No global user store.** A provider whose native model is one tenant-wide directory of all humans is eliminated, even if it offers “data residency” as a region pin on that same directory.
2. **No cross-cell identity replication.** Disaster recovery, analytics, and “global customer 360” must not copy identity records between cells. Correlation, if ever required, is a kernel/policy problem with an explicit legal basis — not an IdP feature.
3. **Keys stay in the cell.** Token-signing keys, WebAuthn trust anchors, recovery material, and KYC-document encryption keys are custodied in that cell’s KMS/HSM. A vendor that signs JWTs with keys it holds outside the cell fails the filter.
4. **Admin and logs stay in the cell.** IdP admin consoles, audit trails, and support break-glass must not require identity payloads to leave the cell.
5. **Five cells means five deployments (or five equivalent isolated instances).** Logical “realms”, “tenants”, or “organizations” **on a shared cluster** are not cells. Shared JVM, shared database, shared cache, and shared signing keys are a single directory with labels.

This filter is applied **before** feature comparison. Options that fail it are out, regardless of passkeys, DX, or time-to-market.

This filter is an **architectural residency constraint**. It is not a legal opinion that any topology satisfies a named statute.

---

## 3. Priority order

Solstice evaluates platform choices in this order. Later items may not override earlier ones.

1. **Asset safety** — identity takeover is theft of the authority to move funds. The stack must make impersonation, recovery-account takeover, and silent session elevation harder, not faster to ship.
2. **Data sovereignty** — Sovereign Cells (hard filter above).
3. **Evidence integrity** — every authentication, step-up, refusal, recovery, and KYC transition must be exportable into the hash-chained Evidence Vault (approvals **and** refusals).
4. **Key custody and operability** — Solstice must be able to rotate, revoke, and escrow cell keys without a vendor’s permission.
5. **Exitability** — a provider failure or acquisition must not trap legal-identity or KYC state.
6. **Feature velocity** — last. Login UX, hosted components, and SDK polish do not outrank 1–5.

---

## 4. Option A — Build in-house

Build Solstice ID as first-party software: credential storage, WebAuthn/passkeys, session/AAL, recovery, device binding, MFA, risk signals, KYC state machine, residency, and the Identity proof assembler. No IdP product.

### 4.1 What must be built

A non-exhaustive production list:

- WebAuthn/FIDO2 ceremonies (registration, assertion, attestation policy, backup-eligible vs device-bound passkeys, RP ID per cell, origin binding).
- Session issuance, rotation, reuse detection, and token binding (DPoP or equivalent).
- Authenticator assurance levels and step-up that the kernel can demand per `ActionIntent`.
- MFA (passkey, TOTP at minimum; SMS OTP is a known takeover path and must not be the high-assurance factor).
- Account recovery that is not a bypass of passkeys (recovery codes, dual control, cool-down). This is the historically most-attacked surface in home-grown auth.
- Credential-stuffing, brute-force, and bot defenses.
- Device inventory, attestation, revocation, and lost-device flows.
- Legal identity and KYC state with **versioning and refresh** (not a boolean `kyc_ok`).
- Cell-scoped person IDs, residency binding, and refusal to serve a subject from the wrong cell.
- Audit events sealed into the Evidence Vault.
- Admin IAM for identity operators inside the cell (the meta-IdP problem).

### 4.2 Pros

- Maximum fit to Sovereign Cells: data, keys, and logs never leave by construction.
- KYC versioning, residency, device trust, and Identity-proof shape can be modelled as Solstice domain types rather than vendor metadata.
- No vendor concentration on the authentication path.
- Exit plan is “we already own it.”

### 4.3 Cons and security burden

- Solstice becomes an identity-security vendor. The protocol surface (WebAuthn attestation, session fixation, recovery, CSRF on auth cookies, JWT alg confusion, token substitution) is a dedicated product class. Defects here mint Execution Authority for an attacker.
- Time and staff cost sit on the **wrong end** of the priority order: years of hardening before the kernel can trust Identity proofs.
- Auditors will treat a greenfield IdP as higher residual risk than a widely deployed self-hosted IdP operated in-cell.
- Feature velocity is worst of the three options, and that is not the main objection — **asset safety** is. Home-grown recovery and session code is where banks get broken.

### 4.4 Verdict against the hard filter

**Passes** the Sovereign Cell filter, if (and only if) each cell runs its own Solstice ID datastore and keys with no cross-cell replication.

**Fails** the priority order as the *authentication protocol* implementation: asset safety first forbids reinventing WebAuthn, session, and recovery unless a dedicated identity-security team exists and accepts the burden in writing.

The **Solstice-specific domain** (legal identity, KYC versions, residency, device-trust *policy*, Identity proof, vault sealing) must be in-house under every option. Option A’s distinctive claim is building the *protocol plane* as well. That distinctive claim is what this ADR rejects.

---

## 5. Option B — Self-hostable provider, deployed per cell

Adopt an identity **runtime** that Solstice operates as an independent instance inside each Sovereign Cell. Solstice still owns Solstice ID domain state (legal identity, KYC versions, residency, device-trust registry, Identity proof assembler, vault adapter). The provider supplies credential, session, MFA, passkey, and OIDC/OAuth protocol machinery.

**Per-cell isolation is genuine only when each cell has all of:** its own compute, its own database, its own signing keys in cell KMS/HSM, its own backups, its own admin plane, and **no** user federation, cache, or replica into another cell. One cluster with five realms/tenants is **not** five cells.

### 5.1 Candidates

#### Keycloak (Apache 2.0)

- **What it is:** Java/Quarkus IdP. OIDC, SAML, WebAuthn/passkeys, OTP MFA, required actions, brute-force detection, event SPI, LoA / `acr` for step-up.
- **Per-region isolation genuinely achievable?** **Yes**, as **independent clusters** (one Keycloak + PostgreSQL + Infinispan + cell KMS keys per cell). **No**, if isolation is attempted via realms on a shared cluster (shared process, DB, keys, admin). Cross-cell user federation and multi-site cache replication would also fail the filter and must be forbidden by cell runbooks.
- **Fit notes:** Strong protocol coverage and auditor familiarity. Large admin-console and SPI attack surface; console must be cell-local and locked down. Does not model KYC versions or Solstice device trust; those stay in Solstice ID. Event SPI can emit authn events for vault export, but the mapping is Solstice’s job.

#### Ory Kratos + Ory Hydra (Apache 2.0; optionally Keto / Oathkeeper later)

- **What it is:** Go, API-first. Kratos = identities, credentials, self-service, sessions, AAL. Hydra = OAuth2/OIDC. Headless by design.
- **Per-region isolation genuinely achievable?** **Yes**, as **independent Kratos+Hydra+Postgres per cell** with cell-local courier (email/SMS) and cell-local keys. **No** for *Ory Network* (the managed SaaS): it globally replicates operational data and homes personal data in Ory-operated regions — that is Option C and fails the five-cell filter (see §6).
- **Fit notes:** Best match to “kernel consumes proofs” because there is no mandatory portal owning the user. Passkeys/WebAuthn and AAL step-up exist; Solstice still builds UI and risk policy. More assembly than Keycloak. Does not do KYC versioning.

#### ZITADEL (Apache 2.0 self-hosted)

- **What it is:** Go, event-sourced IdP. OIDC/SAML, passkeys, MFA, step-up, B2B organizations. Single-binary operational profile.
- **Per-region isolation genuinely achievable?** **Yes** for **self-hosted** independent instances per cell (own Postgres, own keys). **No** for ZITADEL Cloud (vendor-operated regions; not a Solstice SA/UAE cell). Event sourcing is useful for audit *inside* the instance; events still need a vault adapter, and event stores must not be shipped out of cell.
- **Fit notes:** Middle ground between Keycloak ops-weight and Ory component-count. Organization multi-tenancy is not a substitute for cells.

#### FusionAuth (self-hosted)

- **What it is:** Developer-focused IdP. WebAuthn, MFA, step-up, lambdas. Community/self-hosted and commercial editions.
- **Per-region isolation genuinely achievable?** **Yes** for **self-hosted** independent instances per cell. **No** for FusionAuth Cloud (vendor regions, vendor keys).
- **Fit notes:** Fast to operate. Licensing and edition splits are a concentration and exit risk (advanced MFA historically gated). Treat license change or acquisition as a first-class failure mode. KYC still in-house.

#### Authentik (MIT; secondary)

- **What it is:** Python IdP, modern UX, OIDC/SAML, WebAuthn.
- **Per-region isolation genuinely achievable?** **Yes** if self-hosted independently per cell.
- **Fit notes:** Smaller banking operational track record than Keycloak/Ory. Keep as a fallback, not the lead candidate.

### 5.2 Pros

- Passes the Sovereign Cell filter when deployed as independent in-cell instances (the candidates above can; their SaaS twins cannot).
- Authentication cryptography, session, and recovery are not invented at Solstice.
- Standard OIDC (`acr`/`amr`, AAL) gives the Identity proof assembler something typed to consume.
- Apache 2.0 candidates (Keycloak, Ory, ZITADEL) reduce license-hostage risk.

### 5.3 Cons

- Solstice still operates five IdP production systems (patch, HSM, break-glass, theme, threat detection).
- Misconfiguration can accidentally federate or replicate out of cell — the filter is achievable, not automatic.
- KYC versioning, legal identity, residency as a kernel fact, and vault sealing are **not** provided. They remain in-house (correctly).
- Vendor (or OSS-project) abandonment still requires an exit plan (§8).

---

## 6. Option C — Managed SaaS provider

Use a vendor-operated identity cloud (Auth0, Cognito, Clerk, Okta, Entra External ID, Ory Network, etc.). Even “regional” SaaS is Option C if Solstice does not operate the instance and does not custody the keys inside the cell.

### 6.1 Why the class fails the hard filter

Sovereign Cells require identity data **inside Solstice’s cell**, in all five regions, with Solstice-held keys and no global directory. Managed CIAM products are built around a **vendor tenant** (one logical user directory per customer, optionally pinned to a vendor region the vendor happens to offer). That is the opposite topology.

A vendor region in `eu-west-1` is not an EU Sovereign Cell. A vendor “UAE private cloud” is not a UAE Sovereign Cell unless Solstice operates it, keys it, backs it up, and can refuse vendor support access to identity payloads — which is no longer SaaS.

### 6.2 Providers eliminated by the data-residency constraint

Eliminated because they require a vendor-centralized (or vendor-regional-but-not-five-cell) directory, do not offer Solstice-operated instances in all of US / EU / SA / UAE / UK, and/or replicate control-plane or operational identity data outside the home cell. **This is an architectural elimination, not a compliance ruling.**

| Provider | Why the Sovereign Cell filter eliminates it |
| --- | --- |
| **Clerk** | SaaS-only. Identity store is US-only as of this writing; an EU region is roadmap, not a product. No self-host. No SA/UAE/UK cell Solstice can operate. Global product directory by construction. |
| **Auth0 public cloud (Okta CIC)** | Tenant lives in one Auth0 public region (documented set: US, UK, EU, AU, JP). That is a vendor directory, not a Solstice cell. No public region in Saudi Arabia or UAE. Metadata, extensions, and support tooling are vendor-operated. |
| **Auth0 private cloud** | Still vendor-operated. Okta documents private cloud on AWS in many countries including UAE and Bahrain; **Auth0’s own support article (updated 2025-09-10) states neither public nor private KSA deployments are on the 12-month roadmap.** UAE-or-Bahrain private cloud is not a Saudi cell, and keys/ops remain Okta’s. Fails the five-cell filter. |
| **Okta Workforce Identity Cloud / Customer Identity Cloud** | Central Okta tenant directory. Data-residency add-ons pin some data to vendor regions Okta offers; they do not create Solstice-operated SA and UAE cells or give Solstice token-signing key custody inside those cells. |
| **Amazon Cognito** | Regional AWS service, not a Solstice cell. User pools exist in US, London (`eu-west-2`), several EU regions, and UAE (`me-central-1`). **Cognito is not available in a Saudi Arabia AWS region** (that region remains announced, not generally available, as of August 2026). AWS holds service keys and control plane. Five independent Cognito pools would still be five AWS-operated directories, not Sovereign Cells, and cannot cover SA. |
| **Firebase Authentication / Google Identity Platform** | Google-operated identity backend. Not deployable as Solstice-controlled instances in SA/UAE cells. Global product architecture. |
| **Microsoft Entra External ID / Azure AD B2C** | Microsoft-operated. Azure has UK and EU and UAE regions; a Saudi Azure region has been discussed on a 2026 timetable and is not a basis for an architecture that must exist in a SA cell under Solstice control. Control plane and key custody remain Microsoft’s. |
| **Ory Network** | Managed Ory. Personal data is homed in Ory-operated regions; **operational data is globally replicated** by design. Super-region “Global”/“US” homing is the opposite of cell isolation. Not instantiable in a Solstice SA or UAE cell. (Self-hosted Ory is Option B, not C.) |
| **ZITADEL Cloud, FusionAuth Cloud, SuperTokens Cloud, Stytch, Descope, WorkOS, Frontegg, Authgear Cloud, PingOne, ForgeRock Identity Cloud** | Vendor-operated CIAM. Region lists, where they exist, are vendor clouds (typically US/EU and similar). None is a Solstice-operated identity plane in all five cells with in-cell key custody. |

Ping Identity **software** (self-hosted) could be re-evaluated under Option B if Solstice later accepts its operational and commercial model; **PingOne / Identity Cloud** remains Option C and is eliminated.

### 6.3 Pros (acknowledged, then discarded)

- Fastest feature velocity (hosted passkeys, bot defense, dashboards).
- Vendor patches CVEs.

Velocity is last in the priority order. The hard filter already discards the class.

### 6.4 Cons

- Fails Sovereign Cells.
- Vendor holds signing keys.
- Audit logs often land in vendor SIEM regions; export into an in-cell Evidence Vault is delayed, incomplete, or a cross-border transfer.
- Acquisition or price change is an existential lock-in on the path that authorizes money movement.
- KYC versioning and kernel-shaped proofs will be jammed into `app_metadata` and cannot be first-class.

---

## 7. Cross-cutting analysis

Evaluation of the three options against the decision dimensions. “Yes” means the option *can* satisfy the dimension if designed that way; it is not a certification.

| Dimension | Option A (in-house protocol + domain) | Option B (self-host IdP per cell + in-house domain) | Option C (managed SaaS) |
| --- | --- | --- | --- |
| **Per-cell data residency** | Achievable by construction. | Achievable iff independent instances; forbidden to use shared-cluster tenancy as a cell. | **Fails** for the five-cell set. See §6.2. |
| **Key custody** | Solstice holds all keys; must staff HSM, rotation, ceremony, recovery-key escrow. Highest operational burden, highest control. | Solstice holds IdP signing keys in cell KMS/HSM. Provider software uses those keys; vendor does not. Must still prevent admin export of keys. | Vendor typically signs tokens. Solstice cannot guarantee keys never leave the cell. **Fails** the filter. |
| **Passkey / WebAuthn** | Must implement the full ceremony and attestation policy. High defect risk. RP ID **must** be per-cell (`id.<cell>.…`) so credentials cannot assert in another cell. | Keycloak, Ory Kratos, ZITADEL, FusionAuth all support WebAuthn/passkeys. Still require per-cell RP ID and attestation policy written by Solstice. | Most SaaS IdPs support passkeys, on a vendor origin/RP ID Solstice does not control across five cells. |
| **Step-up authentication** | Must invent AAL/LoA and bind it to `ActionIntent` risk. | OIDC `acr`/`amr` and AAL (Kratos) or LoA (Keycloak) can be consumed by the Identity proof assembler. Risk *policy* (when to demand step-up) stays in the kernel, not in the IdP. | Step-up exists as product features; the kernel would depend on vendor session semantics and webhooks that may leave the cell. |
| **Device binding** | Full control: attest app+hardware, revoke, inventory. Must build it. | IdP binds *authenticators* (passkeys, OTP devices). Solstice still needs a **device-trust registry** (app attestation, device identifier, lost-device) in-cell; do not overload IdP “remembered browsers” as device trust. | Vendor device signals are opaque, leave the cell, and cannot be the kernel’s device-trust source. |
| **KYC state versioning and refresh** | Must be in-house. Correct place. | **Must be in-house.** No candidate IdP is a KYC register. Model `KycState { version, status, collected_at, expires_at, evidence_vault_refs }` in Solstice ID. IdP may store only a non-PII pointer (KYC version id). Refresh is a Solstice workflow that invalidates Identity proofs until the new version exists. | Vendor `app_metadata` booleans are not versioned KYC and will drift from the vault. |
| **Audit-log export into the Evidence Vault** | Native: every authn decision (success **and** failure) is a domain event sealed in-cell. | Required adapter: IdP events (login, MFA, step-up, recovery, admin) streamed **in-cell** into the vault’s hash chain. Disable vendor cloud log sinks. Gaps in IdP event coverage become vault gaps and are a security-review item. | Typically fails: logs in vendor region, delayed export, incomplete admin events, or support copies. |
| **Vendor concentration risk** | Low vendor concentration; high concentration on Solstice’s own unproven auth code (a different, worse concentration). | Moderate. OSS Apache 2.0 (Keycloak/Ory/ZITADEL) is preferable to a licensed binary (FusionAuth). Five cells × one engine is still a single-technology concentration — mitigate with an OIDC-shaped anti-corruption layer. | High. Okta/Auth0, AWS, Google, or Microsoft on the money-authorization path. Acquisition risk is material (Auth0 already is an Okta product). |
| **Exit if the provider fails or is acquired** | N/A for a vendor; the exit risk is “our IdP is unmaintainable.” | See §8. Viable if Solstice IDs and KYC are not stored *as* IdP records. | Painful: proprietary user stores, passkeys registered to vendor RP IDs, sessions that cannot be reissued, logs that vanish with the contract. |

---

## 8. Exit plan (Option B)

The Identity proof assembler must speak **Solstice types**, not vendor types. That is the exit.

1. **Stable identifier:** `solstice_person_id` is minted in-cell by Solstice ID. The IdP `sub` is a credential-account alias, stored as a mapping that can be rewritten.
2. **Passkeys:** WebAuthn credentials are bound to the cell RP ID. An IdP swap inside the *same* cell can keep the RP ID and origin so passkeys survive if credentials are exported (or re-enrolled under a controlled break-glass). A cross-product migration that changes RP ID forces re-enrollment; that cost is accepted and documented.
3. **KYC, legal identity, residency, device trust:** never stored as the source of truth in the IdP. Exporting the IdP must not export the bank.
4. **Sessions:** treat as ephemeral. On exit, revoke all sessions in-cell and re-authenticate. Do not migrate live sessions.
5. **Runbooks:** quarterly credential export drill (users, credential hashes/WebAuthn public keys, TOTP secrets under HSM) written to cell-local encrypted backup that only cell key ceremony can read.
6. **Contractual:** for any non-Apache component (e.g. FusionAuth commercial), source-escrow and a tested replace-with-Keycloak-or-Ory path is a condition of use.
7. **Acquisition of an OSS steward:** continue running the last known-good release in-cell; do not auto-upgrade; the anti-corruption layer is the hedge.

Option C has no credible exit that preserves passkeys and in-cell logs; another reason it is rejected.

---

## 9. Evaluation against the priority order

1. **Asset safety** — Option A puts session and recovery bugs on the fund-movement path. Option C puts a vendor and a cross-border directory on that path. Option B uses battle-tested protocol code Solstice can patch, with step-up and passkeys the kernel can demand. **Winner: B.**
2. **Data sovereignty** — A and B can pass; C fails the hard filter. **Winner: A or B; C out.**
3. **Evidence integrity** — A is native; B needs an in-cell adapter (mandatory). C cannot be trusted to seal refusals in-cell. **Winner: A slightly, B acceptable with adapter.**
4. **Key custody** — A and B (self-host) can use cell HSM. C cannot. **Winner: A or B.**
5. **Exitability** — A owns the code; B is exit-able if domain state is not in the IdP; C is not. **Winner: A, then B.**
6. **Feature velocity** — C, then B, then A. **Ignored as a decider** because it is last and C is already eliminated.

Net: **Option B**, with the Solstice ID domain remaining in-house (the part of Option A that is mandatory under every option).

---

## 10. Recommendation (PROPOSED)

**Adopt Option B: a self-hostable identity runtime deployed as an independent instance in each Sovereign Cell, plus an in-house Solstice ID domain service.**

**Lead candidate:** Ory **Kratos + Hydra**, one pair per cell, Postgres and signing keys in that cell, no Ory Network.

**Fallback candidate:** **Keycloak**, one cluster per cell (not five realms on one cluster), if SAML/workforce federation or auditor familiarity with Keycloak becomes a blocking operational fact.

**Do not** build the protocol plane in-house (Option A’s distinctive work). **Do** build in-house, in every cell: legal identity, KYC state versioning and refresh, residency/cell binding, device-trust registry, Identity proof assembler for the Compliance Kernel, and Evidence Vault export of authn/admin events (success and failure).

**Reject Option C** for production identity data. The providers in §6.2 are eliminated by the Sovereign Cell filter.

**Passkeys** are the default high-assurance authenticator; SMS OTP is not an acceptable step-up for intents that can produce Execution Authority. **RP IDs are per-cell.**

This recommendation is **PROPOSED**. It is not authorization to add a dependency, sign a vendor contract, or deploy an IdP.

### 10.1 What a future ACCEPTED decision would still require Solstice to own

Regardless of Kratos vs Keycloak:

- `SolsticePersonId` (cell-scoped, non-portable across cells without an explicit, logged legal process).
- `LegalIdentity` (name, legal form, identifiers as required by the cell’s policy pack — stored in-cell).
- `KycState` with monotonic version, expiry, refresh workflow, and vault evidence refs.
- `DeviceTrust` independent of IdP “remembered device.”
- `IdentityProof` value object consumed by the kernel: subject, assurance level, device trust, KYC version, home cell, time, and vault receipt for the authn events that justified the proof.
- Mapping tables from IdP `sub` → `SolsticePersonId` that can be rebuilt on exit.

---

## 11. Security specialist review — required before any production use

Do not deploy Solstice ID, connect it to a ledger, or enable live money until a security specialist (identity/application security, not only network/SOC) has reviewed and recorded findings on:

1. **Threat model** — account recovery, SIM swap, helpdesk ATO, insider IdP admin, passkey sharing, cloned authenticators, session theft, token substitution, CSRF on callbacks.
2. **WebAuthn policy** — per-cell RP ID and origins; attestation (none vs direct); backup-eligible vs device-bound passkeys for high-assurance intents; metadata service trust.
3. **Step-up binding** — how `acr`/AAL is bound to `ActionIntent` risk classes; that step-up cannot be skipped by an agent proposal; that a lower-AAL session cannot mint Execution Authority for a higher class.
4. **Key custody** — cell HSM/KMS design, JWT signing alg allow-list, rotation, ceremony, compromise playbook; Hydra/Keycloak key export disabled.
5. **Admin plane** — IdP admin console/API reachable only from in-cell break-glass; no vendor support channel that can dump users.
6. **Recovery** — recovery codes, cool-downs, dual control for high-value customers; explicit ban on SMS as high-assurance recovery.
7. **KYC data** — classification, encryption, retention, and that raw KYC documents never enter the IdP.
8. **Vault completeness** — proof that failed logins, failed step-ups, admin reads, and recovery attempts are sealed, not only successes.
9. **Cross-cell leakage** — identifiers, email, device graphs, and analytics that could reconstruct a global directory; log aggregators and error trackers included.
10. **Supply chain** — how IdP images are built, signed, and pinned per cell; SPI/plugin/theme trust for Keycloak; Ory image provenance.
11. **SMS/email courier** — in-cell or cell-approved; contents must not include recoverable secrets; third-party couriers are a residency review of their own.
12. **Production go-live** — this ADR remaining PROPOSED until the above is signed; ACCEPTED does not by itself authorize `REAL_MONEY_ENABLED` or equivalent.

---

## 12. Consequences (if later ACCEPTED)

### Positive

- Identity work can proceed without picking a SaaS that would have to be ripped out at first international cell.
- The kernel can specify Identity proof fields against OIDC AAL/`acr` plus Solstice KYC/device types.
- Exit and vault export are design constraints from day one.

### Negative / accepted costs

- Five IdP production systems to patch and staff.
- Login UI and KYC UX are Solstice’s (especially with Ory).
- Passkeys will not roam across cells (desired).
- No global “lookup this human in every country” API.

### Follow-on work (not authorized by this PROPOSED record)

- Cell topology / Sovereign Cell design note (if not already an ADR).
- Solstice ID domain types and Identity proof contract (types only).
- Evidence Vault event schema for authn.
- Choice-confirmation spike: Kratos vs Keycloak against the §11 checklist (still no production SDK in the money path).

---

## 13. Inspection log (files read)

| Path | Finding |
| --- | --- |
| `README.md` | `# solstice` only. |
| `packages/**` | NOT PRESENT. |
| `services/**` | NOT PRESENT. |
| `docs/**` | NOT PRESENT before this ADR. No Sovereign Cell design doc. |
| `AGENTS.md`, `CODEOWNERS`, `.github/**` | NOT PRESENT. |
| Identity types / permissions package / Identity proof checker | NOT PRESENT. The Identity proof currently checks nothing. |
| ADR-0001 … ADR-0006 | NOT PRESENT. ADR-0006 (policy engine language) remains absent, not merely unresolved. |

Searches performed on the working tree (excluding `.git`): identity-related type names, proof classes, KYC, passkeys, WebAuthn, Sovereign Cells. No application hits.

External material used only as **architecture** input (region availability, product topology), not as compliance evidence: Auth0 KSA availability note (2025-09-10); AWS Cognito regional availability; Ory Network personal-data vs operational-data documentation; vendor public capability lists for WebAuthn/AAL.

---

## 14. Decision

**Proposed, not accepted:** Option B (self-hostable per-cell identity runtime) with in-house Solstice ID domain; lead candidate Ory Kratos+Hydra; fallback Keycloak; Option C eliminated by the Sovereign Cell hard filter; Option A rejected for the protocol plane because it fails asset-safety-first.

Status: **PROPOSED**.
