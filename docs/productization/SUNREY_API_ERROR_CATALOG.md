# SunRey API error catalog

Stable consumer-platform error codes for frontend and Lovable clients.
The machine-readable envelope is `ErrorEnvelope` in
`api/sunrey-consumer-platform-v1.openapi.yaml`.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

Do not display stack traces, provider configuration, or Execution
Authority material. If `safe_to_display` is false, show a generic
message.

| Field | Meaning |
| --- | --- |
| `error_code` | Stable machine code |
| `category` | Group below |
| `retryable` | Safe to retry the same request |
| `user_action_required` | The human must do something |
| `safe_to_display` | Message may be shown directly |
| `request_id` | Correlate support and logs |

## Authentication

| Code | Retry | User action | Safe to display |
| --- | --- | --- | --- |
| `AUTH_REQUIRED` | no | sign in | yes |
| `INVALID_CREDENTIALS` | no | retry login | yes |
| `SESSION_EXPIRED` | no | refresh or sign in | yes |
| `SESSION_REVOKED` | no | sign in | yes |
| `MFA_REQUIRED` | no | complete passkey / step-up | yes |
| `PASSKEY_CHALLENGE_INVALID` | no | restart passkey | yes |
| `DEVICE_NOT_TRUSTED` | no | use a trusted device | yes |
| `DEVICE_BLOCKED` | no | contact support | yes |
| `RECOVERY_REQUIRED` | no | start recovery | yes |

## Authorization

| Code | Retry | User action | Safe to display |
| --- | --- | --- | --- |
| `CAPABILITY_DENIED` | no | request access / use another flow | yes |
| `FEATURE_UNAVAILABLE` | no | hide or disable the feature | yes |
| `SANDBOX_PERSONA_FORBIDDEN` | no | use a non-production sandbox | yes |

## Validation

| Code | Retry | User action | Safe to display |
| --- | --- | --- | --- |
| `VALIDATION_FAILED` | no | fix the request | yes |
| `INVALID_PAGINATION_CURSOR` | no | restart pagination | yes |
| `PAGE_SIZE_EXCEEDED` | no | use page_size ≤ 100 | yes |
| `OVERSIZED_REQUEST` | no | reduce payload | yes |

## Policy

| Code | Retry | User action | Safe to display |
| --- | --- | --- | --- |
| `POLICY_DENIED` | no | change the request or stop | yes |
| `KERNEL_REFUSED` | no | show Kernel state; do not retry as success | yes |

## Compliance

| Code | Retry | User action | Safe to display |
| --- | --- | --- | --- |
| `COMPLIANCE_HOLD` | no | wait for review | yes |

## Approval

| Code | Retry | User action | Safe to display |
| --- | --- | --- | --- |
| `APPROVAL_REQUIRED` | no | complete the approval flow | yes |
| `APPROVAL_PENDING` | no | poll the approval | yes |
| `APPROVAL_NOT_FOUND` | no | refresh approvals | yes |

## Resource

| Code | Retry | User action | Safe to display |
| --- | --- | --- | --- |
| `RESOURCE_NOT_FOUND` | no | navigate away | yes |

## Conflict

| Code | Retry | User action | Safe to display |
| --- | --- | --- | --- |
| `RESOURCE_CONFLICT` | no | reload and retry with a new idempotency key | yes |
| `IDEMPOTENCY_CONFLICT` | no | use a new idempotency key | yes |

## Rate limit

| Code | Retry | User action | Safe to display |
| --- | --- | --- | --- |
| `RATE_LIMITED` | yes | wait, then retry | yes |

## Provider

| Code | Retry | User action | Safe to display |
| --- | --- | --- | --- |
| `PROVIDER_UNAVAILABLE` | yes | wait | yes |

Live banking, FX, and KYC providers are not connected. This code is
reserved so the client can degrade without treating a missing vendor as
a successful write.

## Workflow

| Code | Retry | User action | Safe to display |
| --- | --- | --- | --- |
| `WORKFLOW_FAILED` | yes | retry the job or webhook test | yes |

## Internal

| Code | Retry | User action | Safe to display |
| --- | --- | --- | --- |
| `INTERNAL_ERROR` | yes | retry later | no |

## Action states

Kernel decisions map to `state`:

- `ALLOW` — Execution Authority was issued and the domain service ran
- `REQUIRE_MANUAL_REVIEW` — nothing posted; show approval UI
- `DEFER` — nothing posted; wait
- `BLOCK` — nothing posted; show refusal
- `FEATURE_UNAVAILABLE` — capability/feature is off
- `KERNEL_DENIED` — Compliance Kernel refused the action
- `UNAUTHENTICATED` — no session
