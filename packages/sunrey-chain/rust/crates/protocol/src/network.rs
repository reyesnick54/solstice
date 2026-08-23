//! Canonical SunRey network identity and replay-binding domain.
//!
//! Transactions signed for one network must not replay on another.
//! This module does not enable mainnet.

use serde::{Deserialize, Serialize};

use crate::genesis::{
    LOCAL_DEV_CHAIN_ID, LOCAL_DEV_NETWORK_ID, TESTNET_1_CHAIN_ID, TESTNET_1_NETWORK_ID,
};
use crate::RejectReason;

pub const DEVNET_NETWORK_ID: &str = "net_sunrey_development";
pub const DEVNET_CHAIN_ID: &str = "chn_sunrey_development";
pub const PREPRODUCTION_NETWORK_ID: &str = "net_sunrey_preproduction";
pub const PREPRODUCTION_CHAIN_ID: &str = "chn_sunrey_preproduction";
pub const MAINNET_NETWORK_ID: &str = "net_sunrey_mainnet";
pub const MAINNET_CHAIN_ID: &str = "chn_sunrey_mainnet";
pub const LOCAL_NETWORK_ID: &str = "net_sunrey_local";
pub const LOCAL_CHAIN_ID: &str = "chn_sunrey_local";

/// Productized deployment environments. MAINNET remains reserved and inactive.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum NetworkEnvironment {
    Local,
    Devnet,
    Testnet,
    Preproduction,
    Mainnet,
}

impl NetworkEnvironment {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Local => "LOCAL",
            Self::Devnet => "DEVNET",
            Self::Testnet => "TESTNET",
            Self::Preproduction => "PREPRODUCTION",
            Self::Mainnet => "MAINNET",
        }
    }

    pub fn parse(value: &str) -> Result<Self, RejectReason> {
        match value {
            "LOCAL" => Ok(Self::Local),
            "DEVNET" => Ok(Self::Devnet),
            "TESTNET" => Ok(Self::Testnet),
            "PREPRODUCTION" => Ok(Self::Preproduction),
            "MAINNET" => Ok(Self::Mainnet),
            _ => Err(RejectReason::WrongNetwork),
        }
    }

    pub fn deployable(self) -> bool {
        matches!(self, Self::Local | Self::Devnet | Self::Testnet)
    }

    pub fn production_network_enabled(self) -> bool {
        false
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct NetworkIdentity {
    pub environment: NetworkEnvironment,
    pub network_id: &'static str,
    pub chain_id: &'static str,
    pub canonical: bool,
    pub deployable: bool,
    pub mainnet_active: bool,
}

pub const NETWORK_REGISTRY: &[NetworkIdentity] = &[
    NetworkIdentity {
        environment: NetworkEnvironment::Local,
        network_id: LOCAL_NETWORK_ID,
        chain_id: LOCAL_CHAIN_ID,
        canonical: true,
        deployable: true,
        mainnet_active: false,
    },
    NetworkIdentity {
        environment: NetworkEnvironment::Local,
        network_id: LOCAL_DEV_NETWORK_ID,
        chain_id: LOCAL_DEV_CHAIN_ID,
        canonical: false,
        deployable: true,
        mainnet_active: false,
    },
    NetworkIdentity {
        environment: NetworkEnvironment::Devnet,
        network_id: DEVNET_NETWORK_ID,
        chain_id: DEVNET_CHAIN_ID,
        canonical: true,
        deployable: true,
        mainnet_active: false,
    },
    NetworkIdentity {
        environment: NetworkEnvironment::Testnet,
        network_id: TESTNET_1_NETWORK_ID,
        chain_id: TESTNET_1_CHAIN_ID,
        canonical: true,
        deployable: true,
        mainnet_active: false,
    },
    NetworkIdentity {
        environment: NetworkEnvironment::Preproduction,
        network_id: PREPRODUCTION_NETWORK_ID,
        chain_id: PREPRODUCTION_CHAIN_ID,
        canonical: true,
        deployable: false,
        mainnet_active: false,
    },
    NetworkIdentity {
        environment: NetworkEnvironment::Mainnet,
        network_id: MAINNET_NETWORK_ID,
        chain_id: MAINNET_CHAIN_ID,
        canonical: true,
        deployable: false,
        mainnet_active: false,
    },
];

pub fn identity_for(network_id: &str, chain_id: &str) -> Result<NetworkIdentity, RejectReason> {
    NETWORK_REGISTRY
        .iter()
        .copied()
        .find(|row| row.network_id == network_id && row.chain_id == chain_id)
        .ok_or(RejectReason::WrongNetwork)
}

pub fn environment_for_network(network_id: &str) -> Result<NetworkEnvironment, RejectReason> {
    NETWORK_REGISTRY
        .iter()
        .find(|row| row.network_id == network_id)
        .map(|row| row.environment)
        .ok_or(RejectReason::WrongNetwork)
}

pub fn canonical_identity(environment: NetworkEnvironment) -> NetworkIdentity {
    NETWORK_REGISTRY
        .iter()
        .copied()
        .find(|row| row.environment == environment && row.canonical)
        .expect("every environment has a canonical identity")
}

/// Domain-separated replay binding. A signature over one pair cannot
/// satisfy another pair.
pub fn replay_binding(network_id: &str, chain_id: &str) -> String {
    format!("sunrey.replay.v1|{network_id}|{chain_id}")
}

pub fn assert_same_network(
    expected_network: &str,
    expected_chain: &str,
    actual_network: &str,
    actual_chain: &str,
) -> Result<(), RejectReason> {
    if expected_network != actual_network {
        return Err(RejectReason::WrongNetwork);
    }
    if expected_chain != actual_chain {
        return Err(RejectReason::WrongChain);
    }
    Ok(())
}

pub fn reject_cross_network_replay(
    signed_network: &str,
    signed_chain: &str,
    local_network: &str,
    local_chain: &str,
) -> Result<(), RejectReason> {
    assert_same_network(local_network, local_chain, signed_network, signed_chain)?;
    if replay_binding(signed_network, signed_chain) != replay_binding(local_network, local_chain) {
        return Err(RejectReason::Replay);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn environments_are_explicit_and_mainnet_inactive() {
        assert_eq!(NetworkEnvironment::Local.as_str(), "LOCAL");
        assert_eq!(NetworkEnvironment::Devnet.as_str(), "DEVNET");
        assert_eq!(NetworkEnvironment::Testnet.as_str(), "TESTNET");
        assert_eq!(NetworkEnvironment::Preproduction.as_str(), "PREPRODUCTION");
        assert_eq!(NetworkEnvironment::Mainnet.as_str(), "MAINNET");
        assert!(!NetworkEnvironment::Mainnet.deployable());
        assert!(!NetworkEnvironment::Mainnet.production_network_enabled());
        assert!(!canonical_identity(NetworkEnvironment::Mainnet).mainnet_active);
    }

    #[test]
    fn aliases_map_to_local_and_devnet() {
        assert_eq!(
            environment_for_network(LOCAL_DEV_NETWORK_ID).unwrap(),
            NetworkEnvironment::Local
        );
        assert_eq!(environment_for_network(DEVNET_NETWORK_ID).unwrap(), NetworkEnvironment::Devnet);
        assert_eq!(
            environment_for_network(TESTNET_1_NETWORK_ID).unwrap(),
            NetworkEnvironment::Testnet
        );
    }

    #[test]
    fn cross_network_replay_is_rejected() {
        let err = reject_cross_network_replay(
            TESTNET_1_NETWORK_ID,
            TESTNET_1_CHAIN_ID,
            LOCAL_DEV_NETWORK_ID,
            LOCAL_DEV_CHAIN_ID,
        )
        .unwrap_err();
        assert_eq!(err, RejectReason::WrongNetwork);
        assert_ne!(
            replay_binding(TESTNET_1_NETWORK_ID, TESTNET_1_CHAIN_ID),
            replay_binding(LOCAL_DEV_NETWORK_ID, LOCAL_DEV_CHAIN_ID)
        );
    }

    #[test]
    fn unknown_network_is_rejected() {
        assert_eq!(
            environment_for_network("net_ethereum").unwrap_err(),
            RejectReason::WrongNetwork
        );
    }
}
