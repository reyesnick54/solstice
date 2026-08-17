use serde::{Deserialize, Serialize};

use crate::error::InteropError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ChainStatus {
    Draft,
    DevelopmentOnly,
    ActiveDevelopment,
    Suspended,
    Revoked,
}

impl ChainStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Draft => "DRAFT",
            Self::DevelopmentOnly => "DEVELOPMENT_ONLY",
            Self::ActiveDevelopment => "ACTIVE_DEVELOPMENT",
            Self::Suspended => "SUSPENDED",
            Self::Revoked => "REVOKED",
        }
    }

    pub fn parse(value: &str) -> Result<Self, InteropError> {
        match value {
            "DRAFT" => Ok(Self::Draft),
            "DEVELOPMENT_ONLY" => Ok(Self::DevelopmentOnly),
            "ACTIVE_DEVELOPMENT" => Ok(Self::ActiveDevelopment),
            "SUSPENDED" => Ok(Self::Suspended),
            "REVOKED" => Ok(Self::Revoked),
            _ => Err(InteropError::SchemaInvalid),
        }
    }

    pub fn may_verify(self) -> bool {
        matches!(self, Self::DevelopmentOnly | Self::ActiveDevelopment)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FinalityModel {
    DeterministicBft,
    ProbabilisticLongestChain,
    ExternalCheckpointFinality,
    SimulatedDeterministicBftExternalChain,
}

impl FinalityModel {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::DeterministicBft => "DETERMINISTIC_BFT",
            Self::ProbabilisticLongestChain => "PROBABILISTIC_LONGEST_CHAIN",
            Self::ExternalCheckpointFinality => "EXTERNAL_CHECKPOINT_FINALITY",
            Self::SimulatedDeterministicBftExternalChain => {
                "SIMULATED_DETERMINISTIC_BFT_EXTERNAL_CHAIN"
            }
        }
    }

    pub fn fully_implemented(self) -> bool {
        matches!(self, Self::SimulatedDeterministicBftExternalChain)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ClientType {
    SimulatedDeterministicBft,
    DeterministicBft,
    ProbabilisticLongestChain,
    ExternalCheckpoint,
}

impl ClientType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::SimulatedDeterministicBft => "SIMULATED_DETERMINISTIC_BFT",
            Self::DeterministicBft => "DETERMINISTIC_BFT",
            Self::ProbabilisticLongestChain => "PROBABILISTIC_LONGEST_CHAIN",
            Self::ExternalCheckpoint => "EXTERNAL_CHECKPOINT",
        }
    }

    pub fn fully_implemented(self) -> bool {
        matches!(self, Self::SimulatedDeterministicBft)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ClientStatus {
    Uninitialized,
    Active,
    Expired,
    Frozen,
    Suspended,
}

impl ClientStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Uninitialized => "UNINITIALIZED",
            Self::Active => "ACTIVE",
            Self::Expired => "EXPIRED",
            Self::Frozen => "FROZEN",
            Self::Suspended => "SUSPENDED",
        }
    }

    pub fn can_verify(self) -> Result<(), InteropError> {
        match self {
            Self::Active => Ok(()),
            Self::Frozen => Err(InteropError::ClientFrozen),
            Self::Expired => Err(InteropError::ClientExpired),
            Self::Uninitialized => Err(InteropError::ClientNotFound),
            Self::Suspended => Err(InteropError::ClientNotActive),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ChannelType {
    GenericMessage,
    EconomicAttestation,
    AssetTransferReserved,
    OracleFact,
    IdentityAttestationReserved,
}

impl ChannelType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::GenericMessage => "GENERIC_MESSAGE",
            Self::EconomicAttestation => "ECONOMIC_ATTESTATION",
            Self::AssetTransferReserved => "ASSET_TRANSFER_RESERVED",
            Self::OracleFact => "ORACLE_FACT",
            Self::IdentityAttestationReserved => "IDENTITY_ATTESTATION_RESERVED",
        }
    }

    pub fn high_risk(self) -> bool {
        matches!(
            self,
            Self::EconomicAttestation
                | Self::AssetTransferReserved
                | Self::IdentityAttestationReserved
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ChannelOrdering {
    Ordered,
    Unordered,
}

impl ChannelOrdering {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ordered => "ORDERED",
            Self::Unordered => "UNORDERED",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PacketLifecycle {
    Sent,
    Received,
    Acknowledged,
    TimedOut,
}

impl PacketLifecycle {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Sent => "SENT",
            Self::Received => "RECEIVED",
            Self::Acknowledged => "ACKNOWLEDGED",
            Self::TimedOut => "TIMED_OUT",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ConnectionState {
    Init,
    Try,
    Ack,
    Confirm,
    Open,
}

impl ConnectionState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Init => "INIT",
            Self::Try => "TRY",
            Self::Ack => "ACK",
            Self::Confirm => "CONFIRM",
            Self::Open => "OPEN",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum InteropCapability {
    GenericMessage,
    EconomicAttestation,
    AssetTransferDevOnly,
    OracleFact,
    IdentityAttestation,
}

impl InteropCapability {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::GenericMessage => "GENERIC_MESSAGE",
            Self::EconomicAttestation => "ECONOMIC_ATTESTATION",
            Self::AssetTransferDevOnly => "ASSET_TRANSFER_DEV_ONLY",
            Self::OracleFact => "ORACLE_FACT",
            Self::IdentityAttestation => "IDENTITY_ATTESTATION",
        }
    }

    pub fn matches_channel(self, channel: ChannelType) -> bool {
        matches!(
            (self, channel),
            (Self::GenericMessage, ChannelType::GenericMessage)
                | (Self::EconomicAttestation, ChannelType::EconomicAttestation)
                | (Self::AssetTransferDevOnly, ChannelType::AssetTransferReserved)
                | (Self::OracleFact, ChannelType::OracleFact)
                | (Self::IdentityAttestation, ChannelType::IdentityAttestationReserved)
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CryptoClassification {
    Classical,
    HybridCapable,
    PqCapable,
}

impl CryptoClassification {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Classical => "CLASSICAL",
            Self::HybridCapable => "HYBRID_CAPABLE",
            Self::PqCapable => "PQ_CAPABLE",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RiskClassification {
    DevelopmentSimulation,
    ForeignClassicalWeakestDomain,
    FrozenUntrusted,
    ExpiredUntrusted,
}

impl RiskClassification {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::DevelopmentSimulation => "DEVELOPMENT_SIMULATION",
            Self::ForeignClassicalWeakestDomain => "FOREIGN_CLASSICAL_WEAKEST_DOMAIN",
            Self::FrozenUntrusted => "FROZEN_UNTRUSTED",
            Self::ExpiredUntrusted => "EXPIRED_UNTRUSTED",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ActorKind {
    GovernanceSigner,
    ProtocolOperator,
    Relayer,
    AiPreparer,
    ValidatorConsensus,
}

impl ActorKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::GovernanceSigner => "GOVERNANCE_SIGNER",
            Self::ProtocolOperator => "PROTOCOL_OPERATOR",
            Self::Relayer => "RELAYER",
            Self::AiPreparer => "AI_PREPARER",
            Self::ValidatorConsensus => "VALIDATOR_CONSENSUS",
        }
    }

    pub fn may_activate_chain(self) -> Result<(), InteropError> {
        match self {
            Self::GovernanceSigner | Self::ProtocolOperator => Ok(()),
            Self::AiPreparer => Err(InteropError::AiCannotActivate),
            Self::Relayer => Err(InteropError::RelayerForbidden),
            Self::ValidatorConsensus => Err(InteropError::RelayerForbidden),
        }
    }
}
