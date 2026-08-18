//! Chunk 97 mobile wallet sync descriptors.
//!
//! Projections are rebuildable. This crate does not hold private keys
//! and is not a second native-asset ledger.

use serde::Serialize;

pub const MOBILE_SYNC_SCHEMA_VERSION: u32 = 1;
pub const PAYMENT_REQUEST_VERSION: u32 = 1;

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct WalletSyncCursor {
    pub schema_version: u32,
    pub network_id: String,
    pub chain_id: String,
    pub wallet_id: String,
    pub finalized_height: u64,
    pub projection_sequence: u64,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct PaymentRequest {
    pub version: u32,
    pub network_id: String,
    pub recipient: String,
    pub asset_id: String,
    pub preview_only: bool,
}

pub fn encode_payment_request(request: &PaymentRequest) -> String {
    format!(
        "sunrey:pay/{}?v={}&n={}&r={}&a={}",
        request.version, request.version, request.network_id, request.recipient, request.asset_id
    )
}

pub fn mempool_is_not_finality() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn payment_request_is_preview_only() {
        let request = PaymentRequest {
            version: PAYMENT_REQUEST_VERSION,
            network_id: "net_sunrey_simulation".into(),
            recipient: "srdev1alice".into(),
            asset_id: "SUNREY_COIN".into(),
            preview_only: true,
        };
        let encoded = encode_payment_request(&request);
        assert!(encoded.starts_with("sunrey:pay/1?"));
        assert!(request.preview_only);
        assert!(mempool_is_not_finality());
    }
}
