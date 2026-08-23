# External model readiness checklist

Connecting a real model provider is a later, explicit gate. This
checklist is not approval and does not enable live Agent execution.

Owner: `packages/ai-runtime` (gateway) + `packages/sunrey-agent`
(safety / eval). Credentials stay in `packages/security`.

| Gate | Status on this tree |
| --- | --- |
| DPA / data terms | REQUIRED — not executed |
| Data retention | REQUIRED — fixture only |
| Model version pin | REQUIRED — registry exists, vendor unused |
| Regional processing | REQUIRED — not selected |
| Privacy classification | REQUIRED — never-release classes enforced |
| Credentials | REQUIRED — secret references only, no plaintext |
| Rate limits | IMPLEMENTED in Agent cost controls |
| Cost visibility | IMPLEMENTED as estimated minor units |
| Model eval pass | SANDBOX — fixture providers only |
| Prompt injection pass | SANDBOX — suite passing |
| Tool-use eval pass | SANDBOX — suite passing |
| Financial hallucination pass | SANDBOX — suite passing |
| Security review | REQUIRED |
| Preproduction approval | REQUIRED |

`REAL_AI_PROVIDER_CONNECTED=false`
`LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED=false`
