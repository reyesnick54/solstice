//! Official SunRey Rust client SDK.
//!
//! Adapter over the versioned public HTTP API. Protocol types come from
//! `sunrey-protocol`. Addresses come from `sunrey-wallet`. This crate is
//! not a second ledger or chain.

use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

use serde_json::Value;
use sunrey_wallet::{
    encode_address, session_cannot_sign, AddressAlgorithm, AddressClass, SessionScope,
    SigningIntent,
};

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
pub const PATH_NETWORK_PHASE: &str = "/v1/network/phase";
pub const PATH_NETWORK_CAPABILITIES: &str = "/v1/network/capabilities";
pub const PATH_NETWORK_HEALTH: &str = "/v1/network/health";
pub const PATH_PROTOCOL: &str = "/v1/chain/protocol";
pub const PATH_TX: &str = "/v1/transactions";
pub const PATH_EVENTS: &str = "/v1/events";
pub const PATH_EXCHANGE_MARKETS: &str = "/v1/exchange/markets";
pub const PATH_BLOCKS: &str = "/v1/chain/blocks";
pub const PATH_ASSETS: &str = "/v1/assets";
pub const PATH_MONETARY_POLICY: &str = "/v1/monetary/policy";
pub const PATH_MONETARY_SUPPLY: &str = "/v1/monetary/supply";
pub const PATH_MONETARY_GENESIS: &str = "/v1/monetary/genesis";
pub const PATH_MONETARY_BURNS: &str = "/v1/monetary/burns";
pub const PATH_MONETARY_ISSUANCE_PREFIX: &str = "/v1/monetary/issuance/";
pub const PATH_VALIDATORS: &str = "/v1/validators";
pub const PATH_FEES_POLICY: &str = "/v1/fees/policy";
pub const PATH_FEES_PRICE: &str = "/v1/fees/price";
pub const PATH_FEES_ESTIMATE: &str = "/v1/fees/estimate-v2";
pub const PATH_FEES_RESOURCES: &str = "/v1/fees/resources";
pub const PATH_VALIDATOR_ECONOMIC_POLICY: &str = "/v1/validators/economics/policy";
pub const PATH_GOVERNANCE_PACKAGE: &str = "/v1/governance/operations/package";
pub const PATH_GOVERNANCE_DIFF: &str = "/v1/governance/operations/diff";
pub const PATH_GOVERNANCE_ACTIVATION: &str = "/v1/governance/operations/activation";
pub const PATH_GOVERNANCE_EMERGENCY: &str = "/v1/governance/operations/emergency";
pub const PATH_TREASURY: &str = "/v1/treasury";
pub const PATH_TREASURY_POLICY: &str = "/v1/treasury/policy";
pub const PATH_TREASURY_RESERVES: &str = "/v1/treasury/reserves";
pub const PATH_TREASURY_BUDGETS: &str = "/v1/treasury/budgets";
pub const PATH_TREASURY_DISBURSEMENTS: &str = "/v1/treasury/disbursements";
pub const WEBHOOK_SIGNING_SCHEME: &str = "sunrey-webhook-v1";
pub const PATH_DEVELOPER_APPS: &str = "/v1/developer/apps";
pub const PATH_DEVELOPER_KEYS: &str = "/v1/developer/keys";
pub const PATH_DEVELOPER_WEBHOOKS: &str = "/v1/developer/webhooks";
pub const PATH_DEVELOPER_STATUS: &str = "/v1/developer/testnet/status";
pub const PATH_WALLET_SECURITY: &str = "/v1/wallets/{id}/security";
pub const PATH_WALLET_DEVICES: &str = "/v1/wallets/{id}/devices";
pub const PATH_WALLET_SESSIONS: &str = "/v1/wallets/{id}/sessions";
pub const PATH_WALLET_POLICIES: &str = "/v1/wallets/{id}/policies";
pub const PATH_WALLET_RECOVERY: &str = "/v1/wallets/{id}/recovery";

/// Canonical webhook signing payload. Official clients verify locally
/// and never send private keys or webhook secrets to SunRey servers.
pub fn webhook_signing_payload(
    delivery_id: &str,
    event_id: &str,
    timestamp: &str,
    attempt: u32,
    body_sha256_hex: &str,
) -> String {
    format!(
        "{WEBHOOK_SIGNING_SCHEME}.{delivery_id}.{event_id}.{timestamp}.{attempt}.{body_sha256_hex}"
    )
}

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

pub struct RpcEndpointPool {
    endpoints: Vec<String>,
}

impl RpcEndpointPool {
    pub fn connect(endpoints: impl Into<Vec<String>>) -> Self {
        Self { endpoints: endpoints.into() }
    }

    pub fn clients(&self) -> Vec<SunReyRpcClient> {
        self.endpoints.iter().map(|addr| SunReyRpcClient::connect(addr.clone())).collect()
    }

    pub fn read_with_failover(&self, path: &str) -> Result<Value, SdkError> {
        let mut last = SdkError::Transport;
        for addr in &self.endpoints {
            match SunReyRpcClient::connect(addr).get_path(path) {
                Ok(value) => return Ok(value),
                Err(error) => last = error,
            }
        }
        Err(last)
    }

    /// Failover never blindly resubmits. Status is checked by canonical tx id.
    pub fn submit_idempotent(
        &self,
        signed_envelope_hex: &str,
        network_id: &str,
        transaction_id: &str,
    ) -> Result<Value, SdkError> {
        if let Ok(existing) =
            self.read_with_failover(&format!("/v1/chain/transactions/{transaction_id}"))
        {
            return Ok(existing);
        }
        let Some(primary) = self.endpoints.first() else {
            return Err(SdkError::Transport);
        };
        SunReyRpcClient::connect(primary).submit_transaction(signed_envelope_hex, network_id)
    }
}

impl SunReyRpcClient {
    pub fn connect(addr: impl Into<String>) -> Self {
        Self { addr: addr.into() }
    }

    pub fn get_path(&self, path: &str) -> Result<Value, SdkError> {
        self.get(path)
    }

    pub fn chain_status(&self) -> Result<Value, SdkError> {
        self.get(PATH_STATUS)
    }

    pub fn get_network_phase(&self) -> Result<Value, SdkError> {
        self.get(PATH_NETWORK_PHASE)
    }

    pub fn get_capability_status(&self) -> Result<Value, SdkError> {
        self.get(PATH_NETWORK_CAPABILITIES)
    }

    pub fn get_post_genesis_health(&self) -> Result<Value, SdkError> {
        self.get(PATH_NETWORK_HEALTH)
    }

    pub fn get_protocol_version(&self) -> Result<Value, SdkError> {
        self.get(PATH_PROTOCOL)
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

    pub fn monetary_policy(&self) -> Result<Value, SdkError> {
        self.get(PATH_MONETARY_POLICY)
    }

    pub fn native_supply_summary(&self) -> Result<Value, SdkError> {
        self.get(PATH_MONETARY_SUPPLY)
    }

    pub fn genesis_allocation_summary(&self) -> Result<Value, SdkError> {
        self.get(PATH_MONETARY_GENESIS)
    }

    pub fn issuance_receipt(&self, id: &str) -> Result<Value, SdkError> {
        self.get(&format!("{PATH_MONETARY_ISSUANCE_PREFIX}{id}"))
    }

    pub fn burn_summary(&self) -> Result<Value, SdkError> {
        self.get(PATH_MONETARY_BURNS)
    }

    pub fn validators(&self) -> Result<Value, SdkError> {
        self.get(PATH_VALIDATORS)
    }

    pub fn get_fee_policy(&self) -> Result<Value, SdkError> {
        self.get(PATH_FEES_POLICY)
    }

    pub fn get_base_resource_price(&self) -> Result<Value, SdkError> {
        self.get(PATH_FEES_PRICE)
    }

    pub fn estimate_resources(&self, bytes: u32, sigs: u32) -> Result<Value, SdkError> {
        self.get(&format!("{PATH_FEES_RESOURCES}?bytes={bytes}&sigs={sigs}"))
    }

    pub fn estimate_fee(&self, bytes: u32, sigs: u32) -> Result<Value, SdkError> {
        self.get(&format!("{PATH_FEES_ESTIMATE}?bytes={bytes}&sigs={sigs}"))
    }

    pub fn get_validator_economic_policy(&self) -> Result<Value, SdkError> {
        self.get(PATH_VALIDATOR_ECONOMIC_POLICY)
    }

    pub fn get_validator_bond(&self, validator_id: &str) -> Result<Value, SdkError> {
        self.get(&format!("/v1/validators/{validator_id}/bond"))
    }

    pub fn get_validator_reward_summary(&self, validator_id: &str) -> Result<Value, SdkError> {
        self.get(&format!("/v1/validators/{validator_id}/rewards"))
    }

    pub fn get_validator_public_penalties(&self, validator_id: &str) -> Result<Value, SdkError> {
        self.get(&format!("/v1/validators/{validator_id}/penalties"))
    }

    pub fn get_validator_unbond_status(&self, validator_id: &str) -> Result<Value, SdkError> {
        self.get(&format!("/v1/validators/{validator_id}/unbond"))
    }

    pub fn governance_operation_package(&self) -> Result<Value, SdkError> {
        self.get(PATH_GOVERNANCE_PACKAGE)
    }

    pub fn economic_policy_diff(&self) -> Result<Value, SdkError> {
        self.get(PATH_GOVERNANCE_DIFF)
    }

    pub fn governance_activation_status(&self) -> Result<Value, SdkError> {
        self.get(PATH_GOVERNANCE_ACTIVATION)
    }

    pub fn emergency_protocol_status(&self) -> Result<Value, SdkError> {
        self.get(PATH_GOVERNANCE_EMERGENCY)
    }

    pub fn get_protocol_treasury(&self) -> Result<Value, SdkError> {
        self.get(PATH_TREASURY)
    }

    pub fn get_protocol_reserves(&self) -> Result<Value, SdkError> {
        self.get(PATH_TREASURY_RESERVES)
    }

    pub fn get_treasury_policy(&self) -> Result<Value, SdkError> {
        self.get(PATH_TREASURY_POLICY)
    }

    pub fn get_treasury_budget(&self, budget_id: Option<&str>) -> Result<Value, SdkError> {
        match budget_id {
            Some(id) => self.get(&format!("{PATH_TREASURY_BUDGETS}/{id}")),
            None => self.get(PATH_TREASURY_BUDGETS),
        }
    }

    pub fn get_treasury_disbursement(
        &self,
        disbursement_id: Option<&str>,
    ) -> Result<Value, SdkError> {
        match disbursement_id {
            Some(id) => self.get(&format!("{PATH_TREASURY_DISBURSEMENTS}/{id}")),
            None => self.get(PATH_TREASURY_DISBURSEMENTS),
        }
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

    pub fn get_wallet_security_profile(&self, wallet_id: &str) -> Result<Value, SdkError> {
        self.get(&format!("/v1/wallets/{wallet_id}/security"))
    }

    pub fn get_wallet_devices(&self, wallet_id: &str) -> Result<Value, SdkError> {
        self.get(&format!("/v1/wallets/{wallet_id}/devices"))
    }

    pub fn get_wallet_sessions(&self, wallet_id: &str) -> Result<Value, SdkError> {
        self.get(&format!("/v1/wallets/{wallet_id}/sessions"))
    }

    pub fn get_wallet_policies(&self, wallet_id: &str) -> Result<Value, SdkError> {
        self.get(&format!("/v1/wallets/{wallet_id}/policies"))
    }

    pub fn get_recovery_state(&self, wallet_id: &str) -> Result<Value, SdkError> {
        self.get(&format!("/v1/wallets/{wallet_id}/recovery"))
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

/// Local signing-intent helper. Private keys stay with the caller.
pub fn build_signing_intent(
    transaction_hash: impl Into<String>,
    destination: impl Into<String>,
    quantity: u128,
    asset: impl Into<String>,
    network: impl Into<String>,
) -> SigningIntent {
    SigningIntent {
        transaction_hash: transaction_hash.into(),
        destination: destination.into(),
        quantity,
        asset: asset.into(),
        network: network.into(),
    }
}

pub fn login_is_not_native_signing() -> bool {
    session_cannot_sign(SessionScope::ReadOnly).is_err()
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
        assert!(PATH_MONETARY_POLICY.starts_with("/v1/"));
        assert!(PATH_MONETARY_SUPPLY.starts_with("/v1/"));
        assert!(PATH_MONETARY_GENESIS.starts_with("/v1/"));
        assert!(PATH_MONETARY_BURNS.starts_with("/v1/"));
        assert!(PATH_GOVERNANCE_PACKAGE.starts_with("/v1/"));
        assert!(PATH_GOVERNANCE_DIFF.starts_with("/v1/"));
        assert!(PATH_GOVERNANCE_ACTIVATION.starts_with("/v1/"));
        assert!(PATH_GOVERNANCE_EMERGENCY.starts_with("/v1/"));
        assert!(PATH_TREASURY.starts_with("/v1/"));
        assert!(PATH_TREASURY_POLICY.starts_with("/v1/"));
        assert!(PATH_TREASURY_RESERVES.starts_with("/v1/"));
        assert!(PATH_DEVELOPER_APPS.starts_with("/v1/"));
        assert!(PATH_DEVELOPER_KEYS.starts_with("/v1/"));
        assert!(PATH_DEVELOPER_WEBHOOKS.starts_with("/v1/"));
        assert_eq!(WEBHOOK_SIGNING_SCHEME, "sunrey-webhook-v1");
        assert_eq!(
            webhook_signing_payload("whd_1", "evt_1", "2026-01-01T00:00:00.000Z", 1, "ab"),
            "sunrey-webhook-v1.whd_1.evt_1.2026-01-01T00:00:00.000Z.1.ab"
        );
    }

    #[test]
    fn endpoint_pool_is_constructed_without_blind_resubmit() {
        let pool =
            RpcEndpointPool::connect(vec!["127.0.0.1:1".to_string(), "127.0.0.1:2".to_string()]);
        assert_eq!(pool.clients().len(), 2);
        assert!(pool.read_with_failover(PATH_STATUS).is_err());
    }
}
