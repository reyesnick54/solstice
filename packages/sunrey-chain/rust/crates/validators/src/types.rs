use serde::{Deserialize, Serialize};

pub const SCHEMA_VERSION: u32 = 1;
pub const PROTOCOL_SUITE_ID: &str = sunrey_crypto::PROTOCOL_SUITE_ID;
pub const PROTOCOL_ALGORITHM_ID: &str = sunrey_crypto::PROTOCOL_ALGORITHM_ID;
pub const DOMAIN_VALSET: &str = sunrey_protocol::DOMAIN_VALSET;
pub const DOMAIN_CONSENSUS_PROPOSAL: &str = "sunrey.consensus.proposal.v1";
pub const DOMAIN_CONSENSUS_PREVOTE: &str = "sunrey.consensus.prevote.v1";
pub const DOMAIN_CONSENSUS_PRECOMMIT: &str = "sunrey.consensus.precommit.v1";
pub const NIL_BLOCK_ID: &str = "NIL";

#[derive(Debug, thiserror::Error, Clone, PartialEq, Eq)]
pub enum ValidatorError {
    #[error("{0}")]
    Reason(&'static str, String),
}

impl ValidatorError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Reason(code, _) => code,
        }
    }
}

pub fn err(code: &'static str, message: impl Into<String>) -> ValidatorError {
    ValidatorError::Reason(code, message.into())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ValidatorStatus {
    Candidate,
    Bonded,
    PendingActivation,
    Active,
    PendingExit,
    Jailed,
    Tombstoned,
    Exited,
}

impl ValidatorStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Candidate => "CANDIDATE",
            Self::Bonded => "BONDED",
            Self::PendingActivation => "PENDING_ACTIVATION",
            Self::Active => "ACTIVE",
            Self::PendingExit => "PENDING_EXIT",
            Self::Jailed => "JAILED",
            Self::Tombstoned => "TOMBSTONED",
            Self::Exited => "EXITED",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BondKind {
    SimulationBond,
    NativeProtocolBond,
    AdmissionCredential,
}

impl BondKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::SimulationBond => "SIMULATION_BOND",
            Self::NativeProtocolBond => "NATIVE_PROTOCOL_BOND",
            Self::AdmissionCredential => "ADMISSION_CREDENTIAL",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BondDescriptor {
    pub kind: BondKind,
    pub units: u64,
    pub asset_ref: String,
    pub notes: String,
}

impl BondDescriptor {
    pub fn simulation(units: u64) -> Self {
        Self {
            kind: BondKind::SimulationBond,
            units,
            asset_ref: "SIMULATION.VALIDATOR_BOND".into(),
            notes: "Development accountability primitive. Not customer fiat, not SunRey Coin, not MoonRey."
                .into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PublicKeyRef {
    pub role: String,
    pub purpose: String,
    pub public_key_hex: String,
    pub key_id: String,
    pub suite_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ValidatorRecord {
    pub validator_id: String,
    pub operator_actor_id: String,
    pub controller_kind: String,
    pub legal_entity_ref: Option<String>,
    pub consensus_public_key: PublicKeyRef,
    pub crypto_suite_id: String,
    pub p2p_node_id: String,
    pub p2p_public_key: PublicKeyRef,
    pub governance_public_key: PublicKeyRef,
    pub recovery_key_ref: PublicKeyRef,
    pub reward_address: Option<String>,
    pub bond_descriptor: BondDescriptor,
    pub voting_power: u64,
    pub status: ValidatorStatus,
    pub activation_epoch: u64,
    pub exit_epoch: Option<u64>,
    pub jurisdiction_metadata: String,
    pub protocol_metadata: String,
    pub created_height: u64,
    pub updated_height: u64,
    pub schema_version: u32,
    pub historical_consensus_keys: Vec<PublicKeyRef>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ValidatorSet {
    pub version: u64,
    pub epoch: u64,
    pub validators: Vec<ValidatorRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Epoch {
    pub number: u64,
    pub start_height: u64,
    pub end_height: u64,
    pub validator_set_version: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum QueuedChangeKind {
    AddValidator,
    ActivateValidator,
    ChangeVotingPower,
    RotateConsensusKey,
    ScheduleExit,
    JailValidator,
    RestoreEligibleValidator,
}

impl QueuedChangeKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::AddValidator => "ADD_VALIDATOR",
            Self::ActivateValidator => "ACTIVATE_VALIDATOR",
            Self::ChangeVotingPower => "CHANGE_VOTING_POWER",
            Self::RotateConsensusKey => "ROTATE_CONSENSUS_KEY",
            Self::ScheduleExit => "SCHEDULE_EXIT",
            Self::JailValidator => "JAIL_VALIDATOR",
            Self::RestoreEligibleValidator => "RESTORE_ELIGIBLE_VALIDATOR",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QueuedChange {
    pub kind: QueuedChangeKind,
    pub validator_id: String,
    pub activation_epoch: u64,
    pub controller_kind: String,
    pub voting_power: Option<u64>,
    pub consensus_public_key: Option<PublicKeyRef>,
    pub record: Option<ValidatorRecord>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConsensusMessageType {
    Proposal,
    Prevote,
    Precommit,
}

impl ConsensusMessageType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Proposal => "PROPOSAL",
            Self::Prevote => "PREVOTE",
            Self::Precommit => "PRECOMMIT",
        }
    }

    pub fn domain(self) -> &'static str {
        match self {
            Self::Proposal => DOMAIN_CONSENSUS_PROPOSAL,
            Self::Prevote => DOMAIN_CONSENSUS_PREVOTE,
            Self::Precommit => DOMAIN_CONSENSUS_PRECOMMIT,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConsensusSignRequest {
    pub validator_id: String,
    pub network_id: String,
    pub chain_id: String,
    pub protocol_version: String,
    pub message_type: ConsensusMessageType,
    pub height: u64,
    pub round: u64,
    pub block_id: String,
    pub validator_set_version: u64,
    pub crypto_suite_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SignerSafetyState {
    pub validator_id: String,
    pub chain_id: String,
    pub last_signed_height: u64,
    pub last_signed_round: u64,
    pub last_signed_step: ConsensusMessageType,
    pub canonical_sign_bytes_hash: String,
    pub signature_reference: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TransitionReceipt {
    pub from_version: u64,
    pub to_version: u64,
    pub from_epoch: u64,
    pub to_epoch: u64,
    pub applied: Vec<String>,
    pub next_validator_set_hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EquivocationEvidence {
    pub kind: String,
    pub validator_id: String,
    pub validator_set_version: u64,
    pub height: u64,
    pub round: u64,
    pub message_type: String,
    pub message_a_hash: String,
    pub message_b_hash: String,
    pub signature_a_hex: String,
    pub signature_b_hex: String,
    pub public_key_hex: String,
    pub crypto_suite_id: String,
    pub network_id: String,
    pub chain_id: String,
}

pub const FORBIDDEN_CONTROLLERS: &[&str] = &["AI_AGENT", "ROBOT", "DEVICE"];
pub const PERMITTED_CONTROLLERS: &[&str] = &["HUMAN", "LEGAL_ENTITY", "ENTERPRISE"];
pub const FORBIDDEN_CONSENSUS_PURPOSES: &[&str] = &[
    "EXECUTION_AUTHORITY_SIGNING",
    "CHAIN_OPERATION_SIGNING",
    "P2P_IDENTITY",
    "WALLET_SIGNING",
    "ORACLE_SIGNING",
];
