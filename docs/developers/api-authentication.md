# API authentication

SunRey issues two credential kinds:

| Kind | Use | Secret after create |
| --- | --- | --- |
| `SERVER_SECRET` | Backend integrations | Returned once, then only a hash and hint remain |
| `PUBLIC_CLIENT` | Mobile and browser apps | Publishable identifier only. No privileged server secret |

## Rules

- Store only the secret hash server-side.
- Never embed a `SERVER_SECRET` in a mobile or browser binary.
- A developer API key cannot sign user transactions.
- User signing stays with the local wallet / custody authorization /
  Execution Authority.
- Revoked and rotated keys are rejected.
- Each request is scoped. Missing scope returns `WRONG_SCOPE`.
- Human Information scopes (`HUMAN_INFORMATION_READ`,
  `HUMAN_INFORMATION_REQUEST`, `HUMAN_INFORMATION_CLEAN_ROOM`) are
  separate from `CHAIN_READ`. A developer API key still needs
  application approval, purpose, consent/right, privacy policy, and
  eligibility.

## Header

```
X-SunRey-Developer-Key: <credential id>
X-SunRey-Developer-Secret: <one-time server secret, backend only>
```

Public clients send only the credential id and a public client token.
They cannot retrieve the server secret.

## Rotation

`sunrey-dev key revoke` then `sunrey-dev key create`. Rotation writes an
audit row with the hint only.
