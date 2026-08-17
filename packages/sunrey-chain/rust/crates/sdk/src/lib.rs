//! Official SunRey Rust client SDK.
//!
//! Adapter over the versioned public HTTP API. Protocol types come from
//! `sunrey-protocol`. Addresses come from `sunrey-wallet`. This crate is
//! not a second ledger or chain.

use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

use serde_json::Value;
use sunrey_wallet::{encode_address, AddressAlgorithm, AddressClass};

pub const API_VERSION: &str = "v1";
pub const PUBLIC_NETWORK_ID: &str = "net_sunrey_simulation";
pub const PUBLIC_CHAIN_ID: &str = "chn_sunrey_simulation";
pub const LOCAL_DEV_NETWORK_ID: &str = "net_sunrey_local_dev";
pub const LOCAL_DEV_CHAIN_ID: &str = "chn_sunrey_local_dev";
pub const SUNREY_COIN: &str = "SUNREY_COIN";
pub const MOONREY_COIN: &str = "MOONREY_COIN";
pub const SUITE_ED25519: &str = "sunrey-ed25519-v1";
pub const SUITE_HYBRID: &str = "sunrey-hybrid-ed25519-mldsa-sim-v1";
pub const SUITE_PQ: &str = "sunrey-mldsa-65-v1";
pub const PATH_STATUS: &str = "/v1/chain/status";
pub const PATH_TX: &str = "/v1/transactions";
pub const PATH_EVENTS: &str = "/v1/events";
pub const PATH_EXCHANGE_MARKETS: &str = "/v1/exchange/markets";
pub const PATH_BLOCKS: &str = "/v1/chain/blocks";
pub const PATH_ASSETS: &str = "/v1/assets";
pub const PATH_VALIDATORS: &str = "/v1/validators";

#[derive(Debug, thiserror::Error)]
pub enum SdkError {
    #[error("transport failed")]
    Transport,
    #[error("api error {0}")]
    Api(String),
    #[error("unknown api version")]
    UnknownApiVersion,
}

pub struct SunReyRpcClient {
    addr: String,
}

impl SunReyRpcClient {
    pub fn connect(addr: impl Into<String>) -> Self {
        Self { addr: addr.into() }
    }

    pub fn chain_status(&self) -> Result<Value, SdkError> {
        self.get(PATH_STATUS)
    }

    pub fn submit_transaction(
        &self,
        signed_envelope_hex: &str,
        network_id: &str,
    ) -> Result<Value, SdkError> {
        let body = serde_json::json!({
            "signed_envelope_hex": signed_envelope_hex,
            "network_id": network_id,
        });
        self.post(PATH_TX, &body.to_string())
    }

    pub fn blocks(&self) -> Result<Value, SdkError> {
        self.get(PATH_BLOCKS)
    }

    pub fn assets(&self) -> Result<Value, SdkError> {
        self.get(PATH_ASSETS)
    }

    pub fn validators(&self) -> Result<Value, SdkError> {
        self.get(PATH_VALIDATORS)
    }

    pub fn events(&self, cursor: Option<&str>) -> Result<Value, SdkError> {
        match cursor {
            Some(value) => self.get(&format!("{PATH_EVENTS}?format=json&cursor={value}")),
            None => self.get(&format!("{PATH_EVENTS}?format=json")),
        }
    }

    pub fn exchange_markets(&self) -> Result<Value, SdkError> {
        self.get(PATH_EXCHANGE_MARKETS)
    }

    fn get(&self, path: &str) -> Result<Value, SdkError> {
        http(&self.addr, "GET", path, None)
    }

    fn post(&self, path: &str, body: &str) -> Result<Value, SdkError> {
        http(&self.addr, "POST", path, Some(body))
    }
}

fn http(addr: &str, method: &str, path: &str, body: Option<&str>) -> Result<Value, SdkError> {
    if path.starts_with("/v") && !path.starts_with("/v1/") {
        return Err(SdkError::UnknownApiVersion);
    }
    let mut stream = TcpStream::connect(addr).map_err(|_| SdkError::Transport)?;
    stream.set_read_timeout(Some(Duration::from_secs(2))).ok();
    let req = match body {
        Some(payload) => format!(
            "{method} {path} HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{payload}",
            payload.len()
        ),
        None => format!("{method} {path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n"),
    };
    stream.write_all(req.as_bytes()).map_err(|_| SdkError::Transport)?;
    let mut buf = String::new();
    stream.read_to_string(&mut buf).map_err(|_| SdkError::Transport)?;
    let payload = buf.split("\r\n\r\n").nth(1).unwrap_or("{}");
    serde_json::from_str(payload).map_err(|_| SdkError::Api(payload.to_string()))
}

pub fn public_address(descriptor: &[u8]) -> String {
    encode_address(
        PUBLIC_NETWORK_ID,
        AddressClass::SingleKey,
        AddressAlgorithm::Ed25519V1,
        descriptor,
    )
    .expect("development address")
    .text
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn vectors() -> Value {
        let raw = include_str!("../../../../../../api/sunrey-sdk-vectors-v1.json");
        serde_json::from_str(raw).expect("vectors")
    }

    #[test]
    fn cross_language_identifiers_match() {
        let v = vectors();
        assert_eq!(v["networkId"], PUBLIC_NETWORK_ID);
        assert_eq!(v["chainId"], PUBLIC_CHAIN_ID);
        assert_eq!(v["assetIds"][0], SUNREY_COIN);
        assert_eq!(v["assetIds"][1], MOONREY_COIN);
        assert_eq!(v["cryptoSuiteIds"][0], SUITE_ED25519);
        assert_eq!(v["cryptoSuiteIds"][1], SUITE_HYBRID);
        assert_eq!(v["cryptoSuiteIds"][2], SUITE_PQ);
        assert_eq!(v["feeAsset"], SUNREY_COIN);
        assert_eq!(
            v["protocolVector"]["transactionIdHex"],
            "d11b276ab04e14627d63d2506b36d1b6d2dd9f0d5194a225f1a60ac2b2e161ef"
        );
        let addr = public_address(v["address"]["descriptorUtf8"].as_str().unwrap().as_bytes());
        assert!(addr.starts_with("srdev1"));
    }

    #[test]
    fn public_paths_are_versioned() {
        assert!(PATH_STATUS.starts_with("/v1/"));
        assert!(PATH_TX.starts_with("/v1/"));
        assert!(PATH_EVENTS.starts_with("/v1/"));
        assert!(PATH_EXCHANGE_MARKETS.starts_with("/v1/"));
    }
}
