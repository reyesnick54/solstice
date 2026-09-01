# Trust boundaries

## Diagram

```mermaid
flowchart TB
  subgraph public["Public internet"]
    Mobile[Mobile / Web client]
    Merchant[Merchant systems]
  end

  subgraph edge["API edge"]
    API[Platform API / BFF]
    RPC[Public RPC / sentry]
  end

  subgraph internal["Internal application network"]
    Auth[Identity / sessions]
    Accts[Accounts service]
    Kernel[Compliance Kernel]
    Ledger[Ledger]
    Agent[SunRey Agent + AI runtime]
    Exchange[Exchange]
    Custody[Custody]
    PDV[Personal Data Vault]
    Queue[Message queue]
  end

  subgraph chain["Blockchain zone"]
    Validators[Validators]
    Relayer[Interop relayer]
  end

  subgraph third["Third-party / regulated-provider boundary"]
    Banks[Bank / payment sandbox]
    KYC[KYC provider sandbox]
    AI[AI provider sandbox]
    Oracles[Economic oracle fixtures]
  end

  subgraph priv["Privileged boundary"]
    Admin[Admin / control room]
    HSM[Secret manager / HSM port]
    DB[(PostgreSQL)]
  end

  Mobile -->|TLS bearer| API
  Merchant -->|TLS API key| API
  API --> Auth
  API --> Accts
  Accts --> Kernel
  Kernel --> Ledger
  API --> Agent
  Agent -.->|proposals only| Kernel
  API --> Exchange
  Exchange --> Custody
  API --> PDV
  API --> Queue
  RPC --> Validators
  Relayer --> Validators
  Relayer --> third
  API --> Banks
  Auth --> KYC
  Agent --> AI
  API --> Oracles
  Admin -->|step-up| API
  Accts --> DB
  Ledger --> DB
  Auth --> HSM
  Custody --> HSM
```

## Boundary crossings

| Crossing | From → To | Control |
| --- | --- | --- |
| Public internet | Client → API edge | TLS, bearer auth, rate limits, CORS policy |
| Public internet | Client → RPC | replay guards, chain ID, no admin |
| Internal network | API → services | service identity / mTLS refs, no shared god key |
| Third-party | Provider adapters → vendors | SSRF policy, approved base URL, SecretReference |
| Regulated-provider | Custody/payments → bank sandbox | fixture-only, LIVE_* false |
| Privileged | Admin → operations | named roles, step-up, break-glass evidence |
| Privileged | Services → HSM/KMS | KeyProvider port, no export |
| Privileged | Services → database | role-scoped SQL, no public route |

## Default deny

Public API and public RPC cannot reach databases, HSM, or admin surfaces directly.
See `docs/productization/SUNREY_SECURITY_BASELINE.md` §7.

## Logging / telemetry boundary

Structured logs exit the API with redaction (`services/api/src/logging.ts`).
Provider transport logs use `packages/provider-sdk/src/redaction.ts`.

## Simulation posture

`ENVIRONMENT=simulation`. All `LIVE_*` flags false. Interop production paths fail closed unless separately authorized.
