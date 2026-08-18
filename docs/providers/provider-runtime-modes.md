# Provider runtime modes

Canonical execution modes:

| Mode | Meaning |
| --- | --- |
| `LOCAL_SIMULATION` | Deterministic local mocks. Default CI path. |
| `SANDBOX` | Real sandbox credentials supplied through `SecretReference`. |
| `INTEGRATION_TEST` | External integration test when credentials are present. Reported as `EXTERNAL_INTEGRATION_TEST`. |
| `PRODUCTION_CANDIDATE_DISABLED` | Configured candidate. Not live. Reuses the Chunk 69 name. |
| `PRODUCTION_AUTHORIZED` | Requires configured external evidence **and** human authority. |

`sunrey-ops provider runtime-test` reports only:

- `LOCAL_SIMULATION`
- `SANDBOX`
- `EXTERNAL_INTEGRATION_TEST`

Sandbox success cannot mark a provider legally approved. AI cannot
satisfy provider approval.
