# API versioning

Initial public API: **v1**.

Compatibility classes:

- `BACKWARD_COMPATIBLE` — additive fields, new optional query parameters
- `DEPRECATED` — still served, scheduled for removal
- `BREAKING_CHANGE` — new major version (`v2`)

A SunRey protocol upgrade does not automatically imply an API breaking
change. Protocol version and API version are independent.

Unknown versions such as `/v9/...` return `UNKNOWN_API_VERSION`.

## Compatibility policy

Existing SDK clients are not silently broken. Additive fields are
`BACKWARD_COMPATIBLE`. Removals require `DEPRECATED` metadata and a
later major version (`BREAKING_CHANGE`). Protocol upgrades do not
automatically change the API version.

Deprecation metadata lives in `@solstice/sunrey-sdk`
`API_DEPRECATIONS`. The current v1 list is empty.

Chunk 94 control-plane routes are versioned under `/v1/developer/...`
and specified in `api/sunrey-developer-platform-v1.openapi.yaml`.
Webhook events are versioned in `api/sunrey-webhooks-v1.json`.
