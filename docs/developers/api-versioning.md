# API versioning

Initial public API: **v1**.

Compatibility classes:

- `BACKWARD_COMPATIBLE` — additive fields, new optional query parameters
- `DEPRECATED` — still served, scheduled for removal
- `BREAKING_CHANGE` — new major version (`v2`)

A SunRey protocol upgrade does not automatically imply an API breaking
change. Protocol version and API version are independent.

Unknown versions such as `/v9/...` return `UNKNOWN_API_VERSION`.
