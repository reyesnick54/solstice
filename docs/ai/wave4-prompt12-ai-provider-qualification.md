# Wave 4 Prompt 12 — AI Provider Qualification (Grok/xAI + Financial Agent Safety)

## Architecture path

```
SunRey Feature (Grow / Agent conversation)
      ↓
packages/sunrey-agent (mandates, ProposalGate)
      ↓
Prompt policy + minimizeContext (packages/ai-runtime)
      ↓
AiModelGateway / AiRuntime router
      ↓
Provider adapter (S3M primary, XAI_GROK, LOCAL_TEST)
      ↓
Structured validation (parseStructuredOutput)
      ↓
Agent proposal / tool intents (executes: false)
      ↓
UserAgentMandateEngine + ProposalGate
      ↓
Kernel ActionIntent (human approval required)
      ↓
Execution Authority (never from model output)
```

## Provider adapters

| Provider | Path | External network |
|----------|------|------------------|
| S3M | `packages/ai-runtime/src/providers/s3m/` | Simulation / injected transport |
| xAI Grok | `packages/ai-runtime/src/providers/xai-grok.ts` | Preview-only HTTPS when explicitly enabled |
| LocalTest | `packages/ai-runtime/src/providers/local-test.ts` | Never |
| HTTPS generic | `packages/ai-runtime/src/providers/https-generic.ts` | Fixture-first |

## Configured xAI defaults

| Setting | Default | Env override |
|---------|---------|--------------|
| Base URL | `https://api.x.ai` | `XAI_BASE_URL` |
| Path | `/v1/responses` | `XAI_RESPONSES_PATH` |
| Model | `grok-4.6` | `XAI_MODEL` |
| Timeout | 30s | `XAI_TIMEOUT_MS` |
| Max output tokens | unset | `XAI_MAX_OUTPUT_TOKENS` |
| Credential | none | `XAI_CREDENTIAL_REF` or `SUNREY_SECRET_XAI_API_KEY` |
| Live preview | false | `SUNREY_EXTERNAL_AI_PREVIEW_ENABLED=true` |

Model selection is registry-driven (`packages/ai-runtime/src/registry.ts`, inference catalog). Do not hard-code replacements.

## Qualification stages

Stages are monotonic evidence gates (not implied by a single successful ping):

1. `API_CONFIGURED` — endpoint and model configured
2. `AUTHENTICATED` — credential resolves
3. `MODEL_AVAILABLE` — configured model accepted by provider
4. `INFERENCE_SUCCESSFUL` — minimal inference completes
5. `STRUCTURED_OUTPUT_VALIDATED` — response passes schema validation
6. `EVALUATION_PASSED` — synthetic safety evaluation harness passes
7. `PRODUCTION_QUALIFIED` — all above + policy gates (still `productionAuthorized: false` in simulation)

Failure classifications are explicit: `AUTHENTICATION_FAILURE`, `BILLING_DISABLED`, `INSUFFICIENT_QUOTA`, `MODEL_NOT_AVAILABLE`, `MODEL_UNAVAILABLE`, etc. They are not collapsed into generic “Grok unavailable.”

## Structured contracts

Growth and financial agents use validated structures, not free-form prose:

- `EXPLANATION` — narrative only
- `FINANCIAL_PROPOSAL` — prepare intents only (`PREPARE_*`)
- `GROWTH_AGENT_PROPOSAL` — advisory growth proposals with `requiredUserApproval: true`, `providerDataReferences`, integer money, `guaranteedReturn: false`
- `MARKET_OPPORTUNITY_RESEARCH` — public market research schema

Invalid output fails closed (`INVALID_STRUCTURED_OUTPUT` / `MODEL_OUTPUT_INVALID`).

## Proposal vs execution boundary

- Models cannot grant Execution Authority (`grantsExecutionAuthority: false`).
- Tool intents always have `executes: false`.
- Forbidden tools: `EXECUTE_PAYMENT`, `EXECUTE_TRADE`, `SIGN_TRANSACTION`, `MINT`, etc.
- `ProposalGate` converts bounded proposals to `ActionIntent`; Kernel issues EA only after human approval and mandate checks.
- AI adapters cannot receive private keys or execute financial mutations.

## Data minimization

`minimizeContext` (`packages/ai-runtime/src/envelope.ts`) allowlists purpose-specific fields. Full HIN/profile fields are stripped by default. External providers require `PUBLIC`/`SYNTHETIC` data class and `userApprovedExternal`.

## Prompt-injection boundary

`buildBoundedPromptSegments` separates SYSTEM POLICY, USER INTENT, and untrusted PROVIDER DATA. Untrusted text is size-limited and never merged into system instructions.

## Fallback policy

When gateway fallback is used, provenance records:

- `requestedProvider` / `requestedModelId`
- `actualProvider` / `actualModelId`
- `fallbackReason`

Responses must not be labeled as Grok when another provider generated them.

High-risk financial purposes default to no silent external fallback (`s3mUnavailableFallsBackToGrok: false`).

## Cost controls

`resolveCostControls` (`packages/ai-runtime/src/certification/cost-controls.ts`) sets per-purpose token and timeout ceilings. Usage is recorded via `UsageAccountant`; customer ledger posting remains `false`.

## Evaluation

Synthetic fixtures cover savings, debt, emergency fund, contradictory goals, unreasonable return, injection, stale data, and more. Run:

```bash
npm run ai:certify:fixture
```

Live xAI qualification (requires credential + `--live`):

```bash
npm run ai:certify:live -- --live
```

## Known limitations

- Simulation remains `ENVIRONMENT=simulation`; `LIVE_*` flags stay false.
- Production qualification requires external billing/account configuration on the xAI side.
- CI uses fixture transport; live inference is opt-in.
- `prv.ai-model.sandbox-certification` production gate remains separate from this harness.

## External dependencies

xAI inference depends on:

- Valid API credential (`XAI_CREDENTIAL_REF` or `SUNREY_SECRET_XAI_API_KEY`)
- Account billing enabled for the configured model
- Model availability for the account tier

Reachability (TCP/HTTP) alone does not prove inference success.
