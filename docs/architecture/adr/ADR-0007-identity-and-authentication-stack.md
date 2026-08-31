# ADR-0007: Identity and Authentication Stack

- **Status:** PROPOSED
- **Date:** 2026-08-13
- **Deciders:** Founders and architecture review. A human must accept or reject this record. This document is not an accepted decision.
- **Consulted:** Security specialist review is **required** before any production use. See the flagged section below. No specialist has reviewed this record.
- **Informed:** Engineering, compliance, and every service that will ask the Compliance Kernel for an Identity proof.
- **Related:** ADR-0006 (Policy Engine language); ADR-0008 (persistence). Neither decides identity.

**Compliance disclaimer:** this ADR evaluates architectural fit (where data lives, who holds keys, whether Solstice can leave a vendor). It does **not** claim that any provider, product, or topology is compliant with any regulation. Fitness for a regulator is a legal and security-specialist determination, not an architectural one.

---

## Context

Solstice is a compliance-first financial OS. The intended control plane is: AI proposes; a deterministic **Compliance Kernel** (the program that authorizes, never the AI) authorizes via six independent proofs; a signed short-lived **Execution Authority** (a time-limited permit the ledger will accept) is the only thing the double-entry ledger accepts; every decision seals into a hash-chained **Evidence Vault**.

The first of those six proofs is **Identity**. Identity is not a login box. It is the kernel input that must attest, for a given intended action, who the legal person is, how strongly they authenticated, on which device, with which Know Your Customer (KYC) record version, in which Sovereign Cell.

A **Sovereign Cell** is an independent deployment of Solstice for one region (United States, European Union, Saudi Arabia, United Arab Emirates, United Kingdom). Identity data of a person whose home cell is C must stay inside cell C. Any option that requires one centralized global user directory is eliminated before features are compared.

**Hard filter (applied first):** if a product's native model is one tenant-wide directory of humans, or if Solstice cannot operate an isolated instance with in-cell keys in all five cells, the product is out. "Data residency" as a pin on a vendor's global directory is not a cell.

### What exists in the repository today

This ADR was written against git commit `de3c633` on `main`.

**Identity-related types that exist** (all in `@solstice/domain`, in process memory, no login):

| Type | File | Lines | What it is |
| --- | --- | --- | --- |
| `Brand<T, Name>` | `packages/domain/src/brand.ts` | 7–9 | A compiler-only wrapper so IDs of different kinds cannot be mixed by accident. |
| `CustomerId` | `packages/domain/src/customer.ts` | 7–14 | A branded non-empty string. Not a login identifier. |
| `LegalEntityId` | `packages/domain/src/legal-entity.ts` | 7–14 | The named legal entity a customer belongs to. Comment at lines 3–5: "Solstice itself is never a legal actor." |
| `Jurisdiction` / `Residency` | `packages/domain/src/jurisdiction.ts` | 3–7, 11–23 | Two-letter country codes. Not a cell, not a home-region binding. |
| `CustomerStatus` | `packages/domain/src/customer.ts` | 16–24 | `PROSPECT`, `PENDING_VERIFICATION`, `ACTIVE`, `SUSPENDED`, `CLOSED`. |
| `KycState` | `packages/domain/src/customer.ts` | 26–34 | `NOT_STARTED`, `IN_PROGRESS`, `VERIFIED`, `FAILED`, `EXPIRED`. |
| `VerificationState` | `packages/domain/src/customer.ts` | 40–44 | `{ kycState, kycRecordVersion, refreshBy }`. Snapshot only. Comment at lines 36–38: this package "does not perform verification." |
| `Customer` | `packages/domain/src/customer.ts` | 46–55 | Frozen in-memory record: ids, jurisdiction, residency, status, verification, timestamps, version. |

**How the Identity proof is currently satisfied:** it is not. There is no Identity proof type, no checker, no session, no authenticator, and no test that an intended action is bound to a person. `transitionCustomerStatus` (`packages/domain/src/customer.ts` lines 160–193) moves `PENDING_VERIFICATION` to `ACTIVE` without reading `verification.kycState`. KYC versioning exists as fields; it is not enforced.

**What does not exist:**

| Expected | Result |
| --- | --- |
| Session, password, passkey, WebAuthn, MFA, device binding | No types, no code |
| Identity proof / Compliance Kernel / Execution Authority | No types, no code |
| Auth service, IdP adapter, OIDC client | No packages, no dependencies |
| Sovereign Cell design documentation | None. Cells are named in ADR-0008 and in this record's brief. No cell topology file. |
| Evidence Vault export of auth events | No vault (see ADR-0008) |
| User directory, whether local or vendor | None |

`packages/domain/src/customer.test.ts` proves status-transition legality. It does not prove that a person authenticated. `packages/domain/src/demo.ts` walks a prospect to closed in memory. That is not an identity stack.

### Why this decision is blocking

Without an identity stack decision:

- The Identity proof cannot be typed against a real authentication assurance level.
- Device binding, passkeys, and step-up cannot be designed against a protocol.
- `VerificationState.kycRecordVersion` has nowhere to hang as a kernel fact.
- A later SaaS choice could silently create a global user directory and violate Sovereign Cells.

**Question this record answers:** Should Solstice build authentication in-house, adopt a self-hostable provider deployed per cell, or use managed SaaS?

---

## Hard filter: which candidates a centralized global directory removes

The filter is architectural. It is not a legal opinion.

Eliminated because they require a vendor-operated (or vendor-regional-but-not-five-cell) directory, do not offer a Solstice-operated instance in all of US / EU / Saudi Arabia / UAE / UK, and/or replicate identity or operational auth data outside the home cell:

| Candidate | Why the Sovereign Cell filter eliminates it |
| --- | --- |
| **Clerk** | SaaS only. No self-host. Identity store is US-only as of this writing; an EU region is roadmap, not a product. No Solstice-operated SA, UAE, or UK cell. Global product directory by construction. |
| **Auth0 public cloud (Okta Customer Identity Cloud)** | One Auth0 tenant in one vendor public region (documented set: US, UK, EU, AU, JP). That is a vendor directory, not a Solstice cell. No public region in Saudi Arabia or the UAE. Metadata, extensions, and support tooling are vendor-operated. |
| **Auth0 private cloud** | Still vendor-operated. Private Cloud on AWS lists many countries including the UAE; Auth0's own support article (updated 2025-09-10) states neither public nor private KSA deployments are on the 12-month roadmap. A UAE-or-Bahrain private cloud is not a Saudi cell, and signing keys remain Okta's. Fails the five-cell filter. |
| **Okta Workforce Identity Cloud** | Central Okta tenant directory. Residency add-ons pin some data to vendor regions Okta offers. They do not create Solstice-operated SA and UAE cells or give Solstice token-signing key custody inside those cells. |
| **Amazon Cognito** | Regional AWS service, not a Solstice cell. User pools exist in US, London, several EU regions, and UAE (`me-central-1`). There is no generally available AWS region in Saudi Arabia as of this writing (the Kingdom remains on AWS's announced list, not the live region table), so Cognito cannot cover a SA cell. Even five Cognito pools would be five AWS-operated directories with AWS-held service keys. |
| **Firebase Authentication / Google Identity Platform** | Google-operated identity backend. Not deployable as Solstice-controlled instances in SA/UAE cells. Global product architecture. |
| **Microsoft Entra External ID / Azure AD B2C** | Microsoft-operated control plane and key custody. Azure regions are not Solstice cells. |
| **Ory Network** (managed) | Personal data is homed in an Ory-operated region; **operational data (sessions, tokens, permissions) is globally replicated by design**. A single global network with "data homing" is the opposite of five isolated cells. Not instantiable as a Solstice SA or UAE cell. Self-hosted Ory is Option B, not this row. |
| **ZITADEL Cloud, FusionAuth Cloud, SuperTokens Cloud, Stytch, Descope, WorkOS, Frontegg, Authgear Cloud, PingOne, ForgeRock Identity Cloud** | Vendor-operated CIAM. Region lists, where they exist, are vendor clouds (typically US/EU and similar). None is a Solstice-operated identity plane in all five cells with in-cell key custody. |

Ping Identity **software** (self-hosted) could be re-evaluated under Option B if Solstice later accepts its operational and commercial model. **PingOne / Identity Cloud** remains managed SaaS and is eliminated.

A vendor region in `eu-west-1` is not an EU Sovereign Cell. Five "tenants" or "realms" on one shared cluster are not five cells.

---

## Option A — Build in-house

Build Solstice ID as first-party software: credential storage, WebAuthn/passkeys, session, recovery, device binding, MFA, risk signals, KYC state machine, residency, and the Identity proof assembler. No identity-provider product.

**Passkeys / WebAuthn** are a browser and device standard for logging in with a hardware-backed key instead of a password. **Step-up** is a second, stronger check demanded for a higher-risk action (for example, moving money) after a weaker login. **Device binding** means a specific device is registered and can be revoked.

### Pros

- Maximum fit to Sovereign Cells: data, keys, and logs never leave by construction, if each cell runs its own datastore.
- KYC versioning already has a foothold in `VerificationState`. An in-house domain can grow that type instead of stuffing it into vendor metadata.
- No vendor concentration on the authentication path.
- Exit plan is "we already own it."

### Cons

- Solstice becomes an identity-security vendor. The protocol surface (WebAuthn attestation, session fixation, account recovery, CSRF on auth cookies, token substitution) is a dedicated product class. Defects here mint Execution Authority for an attacker.
- Time and staff cost sit on the **wrong end** of the priority order: years of hardening before the kernel can trust Identity proofs.
- Auditors will treat a greenfield identity provider as higher residual risk than a widely deployed self-hosted one operated in-cell.
- Home-grown recovery and session code is where banks get broken. Asset safety outranks the satisfaction of owning every line.

### Verdict against the hard filter

**Passes** the Sovereign Cell filter if (and only if) each cell runs its own Solstice ID datastore and keys with no cross-cell replication.

**Fails** the priority order as the *authentication protocol* implementation. The **Solstice-specific domain** (legal identity, KYC versions, residency, device-trust policy, Identity proof, vault sealing) must be in-house under every option. Option A's distinctive claim is building the *protocol plane* as well. That distinctive claim is what this ADR rejects.

---

## Option B — Self-hostable provider, deployed per cell

Adopt an identity **runtime** that Solstice operates as an independent instance inside each Sovereign Cell. Solstice still owns Solstice ID domain state (legal identity, KYC versions, residency, device-trust registry, Identity proof assembler, vault adapter). The provider supplies credential, session, MFA, passkey, and OIDC/OAuth protocol machinery.

**OpenID Connect (OIDC)** is a standard way for a service to ask "who is this person, and how strongly did they authenticate?" without inventing tokens.

Per-cell isolation is genuine only when each cell has all of: its own compute, its own database, its own signing keys in cell key storage, its own backups, its own admin plane, and **no** user federation, cache, or replica into another cell. One cluster with five realms is **not** five cells.

### Lead and fallback candidates (all must be self-hosted)

| Candidate | Isolation genuinely achievable? | Fit notes |
| --- | --- | --- |
| **Ory Kratos + Hydra** (Apache 2.0) — **lead** | **Yes** as independent Kratos+Hydra+Postgres per cell with cell-local keys. **No** for Ory Network (eliminated above). | API-first. Kratos = identities, credentials, sessions, authenticator assurance level (AAL). Hydra = OAuth2/OIDC. Headless: Solstice owns the screens. Passkeys and AAL step-up exist. Does not model KYC versions. |
| **Keycloak** (Apache 2.0) — **fallback** | **Yes** as independent clusters (one Keycloak + Postgres + cell keys per cell). **No** if isolation is attempted via realms on a shared cluster. | Strong protocol coverage, auditor familiarity, large admin-console attack surface. Console must be cell-local. |
| **ZITADEL** self-hosted (Apache 2.0) | **Yes** as independent instances. **No** for ZITADEL Cloud. | Middle ground on operational weight. Organization multi-tenancy is not a substitute for cells. |
| **FusionAuth** self-hosted | **Yes** as independent instances. **No** for FusionAuth Cloud. | Faster to operate. Licensing splits are a concentration and exit risk. |
| **Authentik** self-hosted | **Yes** if independent per cell. | Smaller banking operational track record. Fallback, not lead. |

### Pros

- Passes the Sovereign Cell filter when deployed as independent in-cell instances.
- Authentication cryptography, session, and recovery are not invented at Solstice.
- Standard OIDC (`acr` / `amr`, AAL) gives the Identity proof assembler something typed to consume.
- Apache 2.0 candidates (Keycloak, Ory, ZITADEL) reduce license-hostage risk.
- `CustomerId` / `LegalEntityId` stay Solstice types. The provider `sub` is a mapping that can be rewritten on exit.

### Cons

- Solstice still operates five identity-provider production systems (patch, key storage, break-glass, threat detection).
- Misconfiguration can accidentally federate or replicate out of cell — the filter is achievable, not automatic.
- KYC versioning, legal identity, residency as a kernel fact, and vault sealing are **not** provided. They remain in-house (correctly). `VerificationState` in `customer.ts` is the start of that work, not the finish.
- Vendor or open-source-project abandonment still requires an exit plan.

---

## Option C — Managed SaaS

Use a vendor-operated identity cloud. Even "regional" SaaS is Option C if Solstice does not operate the instance and does not custody the keys inside the cell.

The class fails the hard filter. The table in the hard-filter section is the list. Feature comparison does not revive it.

### Pros (acknowledged, then discarded)

- Fastest feature velocity (hosted passkeys, bot defense, dashboards).
- Vendor patches security flaws.

Velocity is last in the priority order. The hard filter already discards the class.

### Cons

- Fails Sovereign Cells. Identity data, backups, support copies, or operational tokens leave the home cell or never enter it.
- Vendor holds signing keys.
- Audit logs often land in vendor regions; export into an in-cell Evidence Vault is delayed, incomplete, or a cross-border transfer.
- Acquisition or price change is lock-in on the path that authorizes money movement.
- KYC versioning and kernel-shaped proofs will be jammed into `app_metadata` and cannot be first-class. That would fight the types already in `customer.ts`.

---

## Evaluation against Solstice priorities

Priorities are listed in the order Solstice stated. Earlier rows outrank later ones.

| Priority | Option A (in-house protocol) | Option B (self-host IdP per cell) | Option C (managed SaaS) |
| --- | --- | --- | --- |
| **Asset safety** | Worst of the honest options. Recovery and session bugs mint fund-moving authority. | **Best.** Battle-tested protocol code Solstice can patch, with step-up the kernel can demand. | Fails. A vendor and a cross-border directory sit on the money path. |
| **Regulatory control** | Mixed. Full control of policy hooks; no counsel-readable auth artifact until Solstice builds one. | **Better.** OIDC assurance + in-house KYC version as kernel facts. Cell isolation is a deploy rule. | Fails the five-cell control plane. |
| **Data privacy** | Achievable by construction. | Achievable iff independent instances; forbidden to use shared-cluster tenancy as a cell. | **Fails** the hard filter. See the elimination table. |
| **Accounting correctness** | Neutral if Identity proofs are typed; risk is delayed proofs while the protocol is unfinished. | **Better.** Proof assembler can refuse to sign until KYC version, AAL, and cell match. | Worse. Webhooks and vendor session semantics disagree with the ledger clock. |
| **Security** | Highest novel attack surface. | High but known. Admin console and plugins need lockdown. | Vendor surface plus Solstice cannot inspect it in-cell. |
| **Operational resilience** | Solstice pages itself for every auth CVE. | Five systems to patch; fail-closed is honest. | Vendor outage is an outage Solstice cannot patch. |
| **Explainability** | Native events, if built. | Requires an in-cell adapter from IdP events into the Evidence Vault. | Vendor logs are not a vault receipt. |
| **Customer experience** | Slowest to become a trustworthy login. | Solstice owns UI (especially with Ory). Passkeys can be the default. | Fastest login UX; last priority. |
| **Performance** | As good as Solstice builds. | In-cell, one hop. Fine. | Extra hops and vendor regions. |
| **Feature velocity** | Slowest. | Medium. | Fastest, and **ignored as a decider** because C is already eliminated. |

---

## Cross-cutting analysis

### Per-cell data residency

- **A:** Achievable by construction.
- **B:** Achievable iff independent instances.
- **C:** Fails for the five-cell set.

### Key custody

**Key custody** means who holds the keys that sign login tokens and encrypt identity data.

- **A:** Solstice holds all keys; must staff hardware-backed storage, rotation, ceremony, recovery-key escrow.
- **B:** Solstice holds signing keys in cell key storage. Provider software uses those keys; the vendor does not. Must still prevent admin export of keys.
- **C:** Vendor typically signs tokens. Solstice cannot guarantee keys never leave the cell. **Fails** the filter.

### Passkey / WebAuthn

- **A:** Must implement the full ceremony. High defect risk. Relying Party ID (the site name a passkey is bound to) **must** be per-cell so credentials cannot assert in another cell.
- **B:** Kratos, Keycloak, ZITADEL, FusionAuth all support WebAuthn/passkeys. Still require per-cell Relying Party ID and an attestation policy written by Solstice.
- **C:** Most SaaS providers support passkeys, on a vendor origin Solstice does not control across five cells.

### Step-up authentication

- **A:** Must invent assurance levels and bind them to intended-action risk.
- **B:** OIDC `acr`/`amr` and AAL (Kratos) or Level of Authentication (Keycloak) can be consumed by the Identity proof assembler. *When* to demand step-up stays in the kernel, not in the IdP.
- **C:** Step-up exists as product features; the kernel would depend on vendor session semantics and webhooks that may leave the cell.

### Device binding

- **A:** Full control; must build it.
- **B:** The IdP binds authenticators (passkeys, OTP devices). Solstice still needs a **device-trust registry** (app attestation, device identifier, lost-device) in-cell. Do not overload "remembered browsers" as device trust.
- **C:** Vendor device signals are opaque, leave the cell, and cannot be the kernel's device-trust source.

### KYC state versioning and refresh

`VerificationState` already has `kycRecordVersion` and `refreshBy` (`packages/domain/src/customer.ts` lines 40–44). Status transitions ignore both (`transitionCustomerStatus` lines 176–185 copy `verification` unchanged and never check `EXPIRED` or `VERIFIED`).

- **A / B / C:** KYC must be in-house. No identity provider is a KYC register. Model version, status, collected time, expiry, and Evidence Vault refs in Solstice ID. The IdP may store only a non-personal pointer (KYC version id). Refresh is a Solstice workflow that invalidates Identity proofs until the new version exists.
- **C additionally:** vendor `app_metadata` booleans are not versioned KYC and will drift from the vault.

### Export of auth audit logs into the Evidence Vault

The Evidence Vault does not exist yet (ADR-0008). The identity stack must still be chosen so export is possible.

- **A:** Native: every authentication decision (success **and** failure) is a domain event sealed in-cell.
- **B:** Required adapter: IdP events (login, MFA, step-up, recovery, admin) streamed **in-cell** into the vault's hash chain. Disable vendor cloud log sinks. Gaps in IdP event coverage become vault gaps.
- **C:** Typically fails: logs in a vendor region, delayed export, incomplete admin events, or support copies.

### Vendor concentration risk

- **A:** Low vendor concentration; high concentration on Solstice's own unproven auth code (a different, worse concentration).
- **B:** Moderate. Apache 2.0 (Keycloak / Ory / ZITADEL) is preferable to a licensed binary (FusionAuth). Five cells × one engine is still a single-technology concentration — mitigate with an OIDC-shaped anti-corruption layer (a thin wrapper so the kernel speaks Solstice types, not vendor types).
- **C:** High. Okta/Auth0, AWS, Google, or Microsoft on the money-authorization path. Acquisition risk is material (Auth0 already is an Okta product).

### Exit plan if the provider fails or is acquired

- **A:** No vendor; the exit risk is "our identity provider is unmaintainable."
- **B:** Viable if Solstice IDs and KYC are not stored *as* IdP records:
  1. `CustomerId` / a future cell-scoped person id is minted by Solstice. The IdP `sub` is a mapping that can be rewritten.
  2. Passkeys are bound to the cell Relying Party ID. An IdP swap inside the *same* cell can keep that ID so passkeys survive if credentials are exported; a product swap that changes the ID forces re-enrollment.
  3. KYC, legal identity, residency, and device trust never have the IdP as source of truth. Exporting the IdP must not export the bank.
  4. Sessions are ephemeral. On exit, revoke all sessions in-cell and re-authenticate. Do not migrate live sessions.
  5. Quarterly credential-export drill to cell-local encrypted backup.
  6. For any non-Apache component, source-escrow and a tested replace-with-Keycloak-or-Ory path is a condition of use.
  7. Acquisition of an open-source steward: keep running the last known-good release in-cell; do not auto-upgrade.
- **C:** No credible exit that preserves passkeys and in-cell logs.

---

## Migration cost, given the code that exists today

There is no identity provider, no session, and no Identity proof. Cost is "what must be created," plus "what must not be grown in the wrong place."

`Customer`, `KycState`, and `VerificationState` are the start of Solstice ID. They must not be replaced by a vendor user object. They also must not be treated as authentication: nothing in `packages/domain` proves a person is present.

### Option A

- Full WebAuthn, session, recovery, MFA, device registry, KYC workflow, proof assembler, vault adapter.
- **Invasiveness:** highest engineering and highest security burden.
- **Dependencies:** none from a vendor; all from Solstice's ability to not get recovery wrong.
- **Risk:** Phase 1 spends its years on login instead of the kernel.

### Option B

- Deploy one self-hosted IdP instance per cell (dev: one instance standing in for one cell).
- In-house: map IdP `sub` → `CustomerId`; grow `VerificationState` into a real KYC register; Identity proof assembler; in-cell event export.
- Close the hole where `PENDING_VERIFICATION` → `ACTIVE` ignores KYC (a domain change, not authorized by this ADR).
- **Invasiveness:** medium. Protocol is adopted; Solstice types stay Solstice types.
- **Dependencies:** the chosen IdP's release train, plus Postgres in the cell (see ADR-0008). No SaaS SDK in the money path.
- **Risk:** misconfiguration recreates a global directory. Runbooks must forbid user federation and cross-cell replica.

### Option C

- Fastest to a demo login; guaranteed rewrite at the first international cell.
- Would pressure `CustomerId` to become a vendor `sub`.
- **Invasiveness:** low now, existential later.
- **Rejected by the hard filter** before cost is interesting.

---

## Recommendation

**Propose Option B:** a self-hostable identity runtime deployed as an independent instance in each Sovereign Cell, plus an in-house Solstice ID domain service.

**Lead candidate:** Ory **Kratos + Hydra**, one pair per cell, database and signing keys in that cell, no Ory Network.

**Fallback candidate:** **Keycloak**, one cluster per cell (not five realms on one cluster), if SAML/workforce federation or auditor familiarity with Keycloak becomes a blocking operational fact.

**Do not** build the protocol plane in-house (Option A's distinctive work). **Do** build in-house, in every cell: legal identity, KYC state versioning and refresh (extending `VerificationState`, not replacing it with vendor metadata), residency/cell binding, device-trust registry, Identity proof assembler for the Compliance Kernel, and Evidence Vault export of authentication and admin events (success and failure).

**Reject Option C** for production identity data. The providers in the hard-filter table are eliminated by the Sovereign Cell constraint, not by taste.

**Passkeys** are the default high-assurance authenticator; SMS one-time codes are not an acceptable step-up for intents that can produce Execution Authority. Relying Party IDs are per-cell.

This recommendation is **PROPOSED**. It is not authorization to add a dependency, sign a vendor contract, or deploy an identity provider.

---

## Flag: security specialist review required before any production use

Do not deploy Solstice ID, connect it to a ledger, or enable live money until a security specialist (identity and application security, not only network operations) has reviewed and recorded findings on **all** of the following. This ADR remaining PROPOSED does not authorize go-live even if someone likes Option B.

Portions that **must** be reviewed before any production use:

1. **Threat model** — account recovery, SIM swap, helpdesk account takeover, insider IdP admin, passkey sharing, cloned authenticators, session theft, token substitution, CSRF on callbacks.
2. **WebAuthn policy** — per-cell Relying Party ID and origins; attestation; backup-eligible vs device-bound passkeys for high-assurance intents; metadata-service trust.
3. **Step-up binding** — how `acr`/AAL is bound to intended-action risk classes; that step-up cannot be skipped by an agent proposal; that a lower-assurance session cannot mint Execution Authority for a higher class.
4. **Key custody** — cell hardware-backed key design, token-signing algorithm allow-list, rotation, ceremony, compromise playbook; Hydra/Keycloak key export disabled.
5. **Admin plane** — IdP admin console and API reachable only from in-cell break-glass; no vendor support channel that can dump users.
6. **Recovery** — recovery codes, cool-downs, dual control for high-value customers; explicit ban on SMS as high-assurance recovery.
7. **KYC data** — classification, encryption, retention, and that raw KYC documents never enter the IdP. How `kycRecordVersion` and `refreshBy` become kernel-enforced, not decorative fields.
8. **Vault completeness** — proof that failed logins, failed step-ups, admin reads, and recovery attempts are sealed, not only successes.
9. **Cross-cell leakage** — identifiers, email, device graphs, and analytics that could reconstruct a global directory; log aggregators and error trackers included.
10. **Supply chain** — how IdP images are built, signed, and pinned per cell; plugin/theme trust for Keycloak; Ory image provenance.
11. **SMS/email courier** — in-cell or cell-approved; contents must not include recoverable secrets; third-party couriers are a residency review of their own.
12. **Production go-live** — ACCEPTED does not by itself authorize live money.

Until that review exists, treat every protocol choice in this ADR as a proposal, not a build order.

---

## Consequences if accepted

- Identity work can proceed without picking a SaaS that would have to be ripped out at the first international cell.
- The kernel can specify Identity proof fields against OIDC assurance plus Solstice KYC/device types already sketched in `customer.ts`.
- Exit and vault export are design constraints from day one.
- Five IdP production systems to patch and staff.
- Login UI and KYC UX are Solstice's (especially with Ory).
- Passkeys will not roam across cells (desired).
- No global "lookup this human in every country" API.

## Consequences if rejected

- If humans choose A, budget a dedicated identity-security team and delay the kernel until recovery and WebAuthn have been independently reviewed. Do not let product engineers "just add login."
- If humans choose C, they are choosing to fail the Sovereign Cell filter. This ADR will not soften that.

---

## Confirmation

This ADR is confirmed as *written* when this file exists at `docs/architecture/adr/ADR-0007-identity-and-authentication-stack.md` with **Status: PROPOSED**.

This ADR is confirmed as *accepted* only when a human changes the status. Agents must not do that.

This ADR is confirmed as *implemented* only when a per-cell self-hosted IdP (or an explicitly accepted alternative), an in-house Solstice ID domain, an Identity proof assembler, and in-cell vault export exist, and a security specialist has recorded the review above. None of those exist at the time of writing.

---

## Addendum A — Chunk 5 engineering implementation (2026-08-14)

Engineering implemented the **in-house Solstice ID domain** on this tree:

- Canonical owner: `packages/identity` (`IdentityService`, `ActorContextIssuer`)
- Application facade: `services/identity`
- Simulation WebAuthn adapter and simulated KYC/device-risk/business providers
- Sessions, device trust, versioned KYC metadata, business identity foundations
- Authoritative capabilities and signed ActorContext using Chunk 4 `SESSION_SIGNING`
- Kernel identity proof consumes `IdentityFacts`
- Accounts service no longer self-grants `capabilities: [intent.actionType]`

This addendum records **engineering implementation of the identity architecture**. It does **not**:

- Accept this ADR (status remains **PROPOSED**)
- Select a production identity vendor (Ory Kratos+Hydra remains the lead *candidate* only)
- Connect Persona, Onfido, Trulioo, or any live KYC provider
- Mark any rule `CONFIRMED_BY_COUNSEL`

Distinguish three axes:

| Axis | Status after Chunk 5 |
| --- | --- |
| Identity architecture engineered | yes — in-house domain + simulation adapters |
| Vendor selected | no |
| Legal/regulatory requirements confirmed | no |

Security-specialist review in the flagged section is still required before any production use.

**Production activation control (Wave 2 Prompt 6):**

| Identity plane | Implemented? | Production-ready? |
| --- | --- | --- |
| User identity (`Customer`, KYC metadata) | yes — `packages/identity` | no — ADR PROPOSED |
| Authentication (passkey/session simulation) | yes — simulation adapters | no — vendor not selected |
| Authorization (capabilities, ActorContext) | yes — Kernel consumes `IdentityFacts` | no — specialist review outstanding |
| Wallet identity | partial — Chunk 96 wallet security | no |
| Device identity | yes — device trust registry | no |
| Service identity | yes — Chunk 4 foundations | engineering only |
| Provider identity | no — Ory/Keycloak lead candidate only | `EXTERNAL_APPROVAL_REQUIRED` |

`LIVE_EXTERNAL_KYC`, `LIVE_CUSTODY_ENABLED`, and
`LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED` remain `false` in
`packages/config/src/flags.ts`.

---

## Inspection notes (for the record)

- Repository: `github.com/reyesnick54/solstice`
- Commit inspected: `de3c633` (`main`)
- Identity-related files read: `packages/domain/src/customer.ts`, `packages/domain/src/customer.test.ts`, `packages/domain/src/legal-entity.ts`, `packages/domain/src/jurisdiction.ts`, `packages/domain/src/brand.ts`, `packages/domain/src/index.ts`, `packages/domain/src/demo.ts`, `packages/domain/src/time.ts`, `packages/domain/src/result.ts`
- Sovereign Cell design docs: none found
- Existing ADRs read: ADR-0006, ADR-0008
- Identity proof implementation: none. Currently satisfied by nothing.
- External material used only as **architecture** input (region availability, product topology), not as compliance evidence: Clerk enterprise/residency notes; Auth0 KSA availability article (2025-09-10); Auth0 Private Cloud on AWS region list; AWS Cognito regional endpoints and AWS announced-regions copy; Ory Network personal-data vs operational-data documentation.
- No identity SDK, provider, or dependency was installed. No `legalReviewState` or KYC value was modified.
