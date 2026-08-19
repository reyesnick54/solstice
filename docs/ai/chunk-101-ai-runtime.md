# Chunk 101 — SunRey canonical AI runtime

SunRey AI Runtime is the inference plane behind the existing Financial
Agent. It lets SunRey support multiple AI / model providers without
letting any provider become a financial authority.

Canonical owner: `packages/ai-runtime`.

The canonical financial-agent authority remains `packages/sunrey-agent`.
The canonical model governance system remains `packages/model-registry`.
The canonical secrets system remains `packages/security`.

## Provider-neutral architecture

Callers consume only `AiInferenceProvider`:

- `infer()`
- `health()`
- `capabilities()`
- `providerMetadata()`

Provider-specific request and response objects stay inside each adapter.
`AiRuntimeRouter` chooses a provider from task class, runtime mode, model
reference, data classification, jurisdiction, user authorization, provider
health, and policy. Routing is deterministic and auditable. No provider
may choose itself. No model may modify routing policy.

Initial provider kinds:

- `S3M` — intended proprietary primary intelligence engine
- `XAI_GROK` — reserved secondary / demo / beta provider
- `LOCAL_TEST` — deterministic CI provider, no network

Runtime modes: `S3M_PRIMARY`, `S3M_ONLY`, `GROK_BETA_PRIMARY`,
`GROK_DEMO_ONLY`, `DUAL_SHADOW_COMPARE`.

## S3M-primary strategy

S3M is the primary intelligence engine. When S3M is unavailable the
runtime fails closed. It does not silently route sensitive S3M traffic
to an external provider. LocalTest fallback is allowed only for
`PUBLIC` or `SYNTHETIC` data when policy permits it.

## Future Grok beta adapter

xAI / Grok will be connected in Chunk 103. This chunk registers the
kind, reserved model-registry binding, and a fail-closed adapter that
refuses all external networking.

## Tool-intent boundary

Providers may request tools. They may not execute financial actions.
Bounded intents include read and prepare operations plus
`REQUEST_HUMAN_APPROVAL`. Direct tools such as `EXECUTE_PAYMENT`,
`EXECUTE_TRADE`, `SIGN_TRANSACTION`, `MINT`, `BURN`, `CHANGE_MANDATE`,
`ADD_WITHDRAWAL_DESTINATION`, `ROTATE_KEY`, and `RECOVER_WALLET` are
not exposed.

`ToolIntentBroker` can later connect intents to existing SunRey
services. Preparation outputs enter `packages/sunrey-agent` as
proposals and remain subject to `UserAgentMandateEngine`,
`ProposalGate`, the Compliance Kernel, risk, jurisdiction, human
approval, and wallet authorization.

Free-form model text is never an executable financial command.
Malformed or schema-invalid structured output is rejected. Quantities
use canonical integer / money types.

## Privacy boundary

`AiContextReleasePolicy` decides whether a context object may be sent
to S3M, xAI/Grok, or LocalTest. The policy fails closed.

`PRIVATE_KEY_MATERIAL` and `AUTHENTICATION_SECRET` are never sent to
an AI provider. External-provider eligibility is evaluated
independently from task type. Task class does not grant execution
authority.

Credentials use `packages/security` `SecretReference` /
`SecretProvider`. Plaintext provider credentials must not appear in
source, committed config, logs, traces, snapshots, or errors. Traces
store hashes, not raw sensitive prompts.

## Financial Agent authority separation

The runtime does not:

- sign transactions
- hold wallet master keys
- issue Execution Authority
- bypass `packages/sunrey-agent` or the Compliance Kernel
- post ledger journals
- submit Exchange orders or payments
- mint SunRey Coin or MoonRey Coin
- change its own mandate or regulatory policy
- approve itself

`receivesMasterKey` remains `false`. `AI_CANNOT_SIGN` remains
enforced. Self-expansion remains forbidden. `guaranteedReturn` remains
`false`.
