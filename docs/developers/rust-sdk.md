# Rust SDK

Crate: `sunrey-sdk` at `packages/sunrey-chain/rust/crates/sdk`.

```rust
use sunrey_sdk::{SunReyRpcClient, PATH_STATUS, PUBLIC_NETWORK_ID};
```

Modules cover:

- RPC access (`SunReyRpcClient`)
- transaction submission
- block queries
- asset queries
- monetary policy / native supply / genesis / issuance receipt / burns (read-only; no mint)
- validator queries
- event subscriptions (`/v1/events`)

Protocol types are shared with `sunrey-protocol`. Addresses use
`sunrey-wallet`. Cross-language identifiers live in
`api/sunrey-sdk-vectors-v1.json`.
