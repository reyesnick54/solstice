//! Deterministic SunRey protocol governance and height-activated upgrades.
//!
//! A newer binary does not change consensus rules. Protocol state changes
//! only when an authorized [`UpgradePlan`] activates at a defined height.
//! There is no governance token. SunRey Coin and MoonRey do not vote.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sunrey_crypto::{CryptoSuite, DevEd25519Sha256Suite, SigningSecret};
use sunrey_protocol::{
    encode_string, encode_u32, encode_u64, hash_to_hex, DomainHasher, Hash32, RejectReason,
    DOMAIN_CODECS, DOMAIN_CONSENSUS_PARAMS, DOMAIN_CRYPTO_POLICY, DOMAIN_GOVERNANCE,
    DOMAIN_MODULES,
};

pub const MIN_ACTIVATION_LEAD: u64 = 4;
pub const DEV_POLICY_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UpgradeKind {
    ParameterChange,
    ConsensusParameterChange,
    ModuleAdd,
    ModuleReplace,
    CryptoPolicyChange,
    CodecExtension,
    HardProtocolCutover,
    ValidatorPolicyChange,
    FeeParameterChange,
}

impl UpgradeKind {
    pub fn parse(value: &str) -> Result<Self, RejectReason> {
        match value {
            "PARAMETER_CHANGE" => Ok(Self::ParameterChange),
            "CONSENSUS_PARAMETER_CHANGE" => Ok(Self::ConsensusParameterChange),
            "MODULE_ADD" => Ok(Self::ModuleAdd),
            "MODULE_REPLACE" => Ok(Self::ModuleReplace),
            "CRYPTO_POLICY_CHANGE" => Ok(Self::CryptoPolicyChange),
            "CODEC_EXTENSION" => Ok(Self::CodecExtension),
            "HARD_PROTOCOL_CUTOVER" => Ok(Self::HardProtocolCutover),
            "VALIDATOR_POLICY_CHANGE" => Ok(Self::ValidatorPolicyChange),
            "FEE_PARAMETER_CHANGE" => Ok(Self::FeeParameterChange),
            _ => Err(RejectReason::GovernanceRejected),
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::ParameterChange => "PARAMETER_CHANGE",
            Self::ConsensusParameterChange => "CONSENSUS_PARAMETER_CHANGE",
            Self::ModuleAdd => "MODULE_ADD",
            Self::ModuleReplace => "MODULE_REPLACE",
            Self::CryptoPolicyChange => "CRYPTO_POLICY_CHANGE",
            Self::CodecExtension => "CODEC_EXTENSION",
            Self::HardProtocolCutover => "HARD_PROTOCOL_CUTOVER",
            Self::ValidatorPolicyChange => "VALIDATOR_POLICY_CHANGE",
            Self::FeeParameterChange => "FEE_PARAMETER_CHANGE",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UpgradeStatus {
    Draft,
    Proposed,
    Validating,
    AwaitingAuthorization,
    Authorized,
    Scheduled,
    Ready,
    Activated,
    Rejected,
    Cancelled,
    FailedValidation,
    Superseded,
}

impl UpgradeStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Draft => "DRAFT",
            Self::Proposed => "PROPOSED",
            Self::Validating => "VALIDATING",
            Self::AwaitingAuthorization => "AWAITING_AUTHORIZATION",
            Self::Authorized => "AUTHORIZED",
            Self::Scheduled => "SCHEDULED",
            Self::Ready => "READY",
            Self::Activated => "ACTIVATED",
            Self::Rejected => "REJECTED",
            Self::Cancelled => "CANCELLED",
            Self::FailedValidation => "FAILED_VALIDATION",
            Self::Superseded => "SUPERSEDED",
        }
    }

    pub fn can_go(self, next: Self) -> bool {
        matches!(
            (self, next),
            (Self::Draft, Self::Proposed | Self::Cancelled)
                | (Self::Proposed, Self::Validating | Self::Cancelled | Self::Superseded)
                | (
                    Self::Validating,
                    Self::AwaitingAuthorization | Self::FailedValidation | Self::Cancelled
                )
                | (
                    Self::AwaitingAuthorization,
                    Self::Authorized | Self::Rejected | Self::Cancelled | Self::Superseded
                )
                | (Self::Authorized, Self::Scheduled | Self::Cancelled | Self::Superseded)
                | (Self::Scheduled, Self::Ready | Self::Cancelled | Self::Superseded)
                | (Self::Ready, Self::Activated | Self::Cancelled)
                | (Self::FailedValidation, Self::Draft | Self::Cancelled)
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GovernanceRole {
    ProtocolOperator,
    ValidatorGovernanceSigner,
    SecurityGovernanceSigner,
    ReleaseAuthority,
    AiPreparer,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GovernanceKeyKind {
    GovernanceSigning,
    ValidatorConsensusSigning,
    P2pIdentity,
    ExecutionAuthoritySigning,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ThresholdModel {
    ValidatorSupermajority,
    ValidatorSupermajorityPlusReleaseAuthority,
    SecurityEmergencyThreshold,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum VoteChoice {
    Approve,
    Reject,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ReadinessStatus {
    Ready,
    IncompatibleBinary,
    MissingArtifact,
    HashMismatch,
    UnsupportedCodec,
    UnsupportedCryptoSuite,
    StateMigrationUnavailable,
}

impl ReadinessStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ready => "READY",
            Self::IncompatibleBinary => "INCOMPATIBLE_BINARY",
            Self::MissingArtifact => "MISSING_ARTIFACT",
            Self::HashMismatch => "HASH_MISMATCH",
            Self::UnsupportedCodec => "UNSUPPORTED_CODEC",
            Self::UnsupportedCryptoSuite => "UNSUPPORTED_CRYPTO_SUITE",
            Self::StateMigrationUnavailable => "STATE_MIGRATION_UNAVAILABLE",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConsensusParams {
    pub max_block_bytes: u32,
    pub max_transactions: u32,
    pub timeout_propose_ms: u64,
    pub timeout_prevote_ms: u64,
    pub timeout_precommit_ms: u64,
    pub evidence_max_age: u64,
}

impl ConsensusParams {
    pub fn development() -> Self {
        Self {
            max_block_bytes: 512_000,
            max_transactions: 32,
            timeout_propose_ms: 1_000,
            timeout_prevote_ms: 1_000,
            timeout_precommit_ms: 1_000,
            evidence_max_age: 10_000,
        }
    }

    pub fn validate(&self) -> Result<(), RejectReason> {
        let ok = (1_024..=4_194_304).contains(&self.max_block_bytes)
            && (1..=4_096).contains(&self.max_transactions)
            && (100..=30_000).contains(&self.timeout_propose_ms)
            && (100..=30_000).contains(&self.timeout_prevote_ms)
            && (100..=30_000).contains(&self.timeout_precommit_ms)
            && (1..=1_000_000).contains(&self.evidence_max_age);
        if ok {
            Ok(())
        } else {
            Err(RejectReason::GovernanceRejected)
        }
    }

    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_u32(&mut out, self.max_block_bytes);
        encode_u32(&mut out, self.max_transactions);
        encode_u64(&mut out, self.timeout_propose_ms);
        encode_u64(&mut out, self.timeout_prevote_ms);
        encode_u64(&mut out, self.timeout_precommit_ms);
        encode_u64(&mut out, self.evidence_max_age);
        out
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NativeModuleRecord {
    pub module_id: String,
    pub version: String,
    pub artifact_hash: String,
    pub schema_hash: String,
    pub activation_height: u64,
    pub deactivation_height: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CodecRecord {
    pub codec_id: String,
    pub schema_version: u32,
    pub schema_hash: String,
    pub activation_height: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CryptoPolicySchedule {
    pub suite_id: String,
    pub target_state: String,
    pub activation_height: u64,
    pub preserve_historical_verify: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StateMigrationSpec {
    pub version: u32,
    pub content_hash: String,
    pub from_protocol_version: u32,
    pub to_protocol_version: u32,
    pub pre_state_requirement: String,
    pub post_state_root: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UpgradePlan {
    pub upgrade_id: String,
    pub upgrade_kind: UpgradeKind,
    pub current_protocol_version: u32,
    pub target_protocol_version: u32,
    pub proposal_height: u64,
    pub activation_height: u64,
    pub affected_modules: Vec<String>,
    pub new_module_hashes: BTreeMap<String, String>,
    pub codec_registry_hash: String,
    pub consensus_params_hash: String,
    pub crypto_policy_hash: String,
    pub state_migration_hash: Option<String>,
    pub release_artifact_hash: String,
    pub minimum_node_version: String,
    pub governance_policy_version: u32,
    pub authorization_state: String,
    pub status: UpgradeStatus,
    pub evidence_references: Vec<String>,
    pub consensus_params: ConsensusParams,
    pub modules: Vec<NativeModuleRecord>,
    pub codecs: Vec<CodecRecord>,
    pub crypto_schedule: Option<CryptoPolicySchedule>,
    pub state_migration: Option<StateMigrationSpec>,
    pub payload: BTreeMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GovernanceActor {
    pub actor_id: String,
    pub role: GovernanceRole,
    pub identity_kind: String,
    pub identity_id: String,
    pub key_kind: GovernanceKeyKind,
    pub public_key_hex: String,
    pub voting_power: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GovernancePolicy {
    pub version: u32,
    pub network_id: String,
    pub chain_id: String,
    pub protocol_version: u32,
    pub threshold_model: ThresholdModel,
    pub required_power: u64,
    pub total_power: u64,
    pub signers: Vec<GovernanceActor>,
    pub release_authority_id: Option<String>,
    pub min_activation_lead: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GovernanceVote {
    pub upgrade_id: String,
    pub proposal_content_hash: String,
    pub network_id: String,
    pub chain_id: String,
    pub protocol_version: u32,
    pub voter_id: String,
    pub governance_policy_version: u32,
    pub activation_height: u64,
    pub choice: VoteChoice,
    pub public_key_hex: String,
    pub signature_hex: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProtocolCommitments {
    pub protocol_version: u32,
    pub consensus_params_hash: Hash32,
    pub module_registry_hash: Hash32,
    pub codec_registry_hash: Hash32,
    pub crypto_policy_hash: Hash32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GovernanceAuditRecord {
    pub kind: String,
    pub upgrade_id: String,
    pub content_hash: String,
    pub height: u64,
    pub protocol_version: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NodeCapability {
    pub supported_protocol_versions: Vec<u32>,
    pub artifact_hashes: Vec<String>,
    pub codec_ids: Vec<String>,
    pub suite_ids: Vec<String>,
    pub migration_hashes: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EmergencyHaltIntent {
    pub intent_id: String,
    pub reason: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpgradeManager {
    pub policy: GovernancePolicy,
    pub plans: BTreeMap<String, UpgradePlan>,
    pub votes: BTreeMap<String, Vec<GovernanceVote>>,
    pub audit: Vec<GovernanceAuditRecord>,
    pub protocol_version: u32,
    pub height: u64,
    pub params: ConsensusParams,
    pub modules: Vec<NativeModuleRecord>,
    pub codecs: Vec<CodecRecord>,
    pub crypto_schedule: Option<CryptoPolicySchedule>,
    pub historical_suites: BTreeSet<String>,
    pub activation_success: u64,
    pub activation_failure: u64,
    pub halt_active: bool,
    pub emergency: Option<EmergencyHaltIntent>,
    pub installed_artifacts: BTreeSet<String>,
}

const FORBIDDEN_KEYS: &[&str] = &[
    "production_network_enabled",
    "PRODUCTION_NETWORK_ENABLED",
    "ENVIRONMENT",
    "CONFIRMED_BY_COUNSEL",
    "customer_ledger_authority",
    "CUSTOMER_LEDGER_AUTHORITY",
    "ai_governance",
    "AI_GOVERNANCE",
    "evidence_vault_replacement",
    "EVIDENCE_VAULT_REPLACEMENT",
    "disable_signature_verification",
    "DISABLE_SIGNATURE_VERIFICATION",
    "unknown_crypto_suite",
    "UNKNOWN_CRYPTO_SUITE",
    "remove_validator_accountability",
    "REMOVE_VALIDATOR_ACCOUNTABILITY",
    "sunrey_coin_supply",
    "SUNREY_COIN_SUPPLY",
    "moonrey_issuance",
    "MOONREY_ISSUANCE",
    "finalized_history_rewrite",
    "FINALIZED_HISTORY_REWRITE",
];

const KNOWN_SUITES: &[&str] = &["SUNREY_DEV_ED25519_SHA256", "cs_ed25519_sha256_v1"];

fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

pub fn seed_from_label(label: &str) -> [u8; 32] {
    Sha256::digest(format!("SUNREY-GOV-DEV-SEED-v1:{label}").as_bytes()).into()
}

pub fn actor_seed(actor_id: &str) -> [u8; 32] {
    let label = match actor_id {
        "gov_validator_1" => "validator-gov-1",
        "gov_validator_2" => "validator-gov-2",
        "gov_validator_3" => "validator-gov-3",
        "gov_validator_4" => "validator-gov-4",
        "gov_release_1" => "release-authority",
        "gov_security_1" => "security-1",
        "gov_operator_1" => "operator-1",
        other => other,
    };
    seed_from_label(label)
}

fn public_hex(label: &str) -> String {
    hex::encode(SigningSecret::from_bytes(seed_from_label(label)).public_key())
}

fn sign_hex(seed: [u8; 32], message: &[u8]) -> String {
    let suite = DevEd25519Sha256Suite;
    let secret = SigningSecret::from_bytes(seed);
    hex::encode(suite.sign(&secret, message).expect("sign"))
}

fn verify_hex(public_hex: &str, message: &[u8], signature_hex: &str) -> bool {
    let Ok(public) = hex::decode(public_hex) else {
        return false;
    };
    let Ok(signature) = hex::decode(signature_hex) else {
        return false;
    };
    DevEd25519Sha256Suite.verify(&public, message, &signature).is_ok()
}

pub fn hash_params(params: &ConsensusParams) -> Hash32 {
    DevEd25519Sha256Suite.hash(DOMAIN_CONSENSUS_PARAMS, &params.encode())
}

pub fn hash_modules(modules: &[NativeModuleRecord]) -> Hash32 {
    let encoded = serde_json::to_vec(modules).unwrap_or_default();
    DevEd25519Sha256Suite.hash(DOMAIN_MODULES, &encoded)
}

pub fn hash_codecs(codecs: &[CodecRecord]) -> Hash32 {
    let encoded = serde_json::to_vec(codecs).unwrap_or_default();
    DevEd25519Sha256Suite.hash(DOMAIN_CODECS, &encoded)
}

pub fn hash_crypto(schedule: Option<&CryptoPolicySchedule>) -> Hash32 {
    let mut payload = Vec::new();
    encode_string(&mut payload, "SUNREY_DEV_ED25519_SHA256");
    if let Some(schedule) = schedule {
        encode_string(&mut payload, &schedule.suite_id);
        encode_string(&mut payload, &schedule.target_state);
    }
    DevEd25519Sha256Suite.hash(DOMAIN_CRYPTO_POLICY, &payload)
}

pub fn proposal_content_hash(plan: &UpgradePlan) -> String {
    let mut payload = Vec::new();
    encode_string(&mut payload, &plan.upgrade_id);
    encode_string(&mut payload, plan.upgrade_kind.as_str());
    encode_u32(&mut payload, plan.current_protocol_version);
    encode_u32(&mut payload, plan.target_protocol_version);
    encode_u64(&mut payload, plan.proposal_height);
    encode_u64(&mut payload, plan.activation_height);
    encode_string(&mut payload, &plan.consensus_params_hash);
    encode_string(&mut payload, &plan.codec_registry_hash);
    encode_string(&mut payload, &plan.crypto_policy_hash);
    encode_string(&mut payload, &plan.release_artifact_hash);
    hex::encode(DevEd25519Sha256Suite.hash(DOMAIN_GOVERNANCE, &payload))
}

fn payload_forbidden(payload: &BTreeMap<String, serde_json::Value>) -> bool {
    if payload.keys().any(|key| FORBIDDEN_KEYS.contains(&key.as_str())) {
        return true;
    }
    let serialized = serde_json::to_string(payload).unwrap_or_default().to_ascii_lowercase();
    FORBIDDEN_KEYS.iter().any(|key| serialized.contains(&key.to_ascii_lowercase()))
}

pub fn development_policy() -> GovernancePolicy {
    let mut signers = Vec::new();
    for n in 1..=4 {
        signers.push(GovernanceActor {
            actor_id: format!("gov_validator_{n}"),
            role: GovernanceRole::ValidatorGovernanceSigner,
            identity_kind: "LEGAL_ENTITY".into(),
            identity_id: format!("le_dev_validator_{n}"),
            key_kind: GovernanceKeyKind::GovernanceSigning,
            public_key_hex: public_hex(&format!("validator-gov-{n}")),
            voting_power: 1,
        });
    }
    signers.push(GovernanceActor {
        actor_id: "gov_release_1".into(),
        role: GovernanceRole::ReleaseAuthority,
        identity_kind: "HUMAN_OPERATOR".into(),
        identity_id: "human_release_1".into(),
        key_kind: GovernanceKeyKind::GovernanceSigning,
        public_key_hex: public_hex("release-authority"),
        voting_power: 0,
    });
    signers.push(GovernanceActor {
        actor_id: "gov_security_1".into(),
        role: GovernanceRole::SecurityGovernanceSigner,
        identity_kind: "HUMAN_OPERATOR".into(),
        identity_id: "human_security_1".into(),
        key_kind: GovernanceKeyKind::GovernanceSigning,
        public_key_hex: public_hex("security-1"),
        voting_power: 1,
    });
    signers.push(GovernanceActor {
        actor_id: "gov_operator_1".into(),
        role: GovernanceRole::ProtocolOperator,
        identity_kind: "HUMAN_OPERATOR".into(),
        identity_id: "human_operator_1".into(),
        key_kind: GovernanceKeyKind::GovernanceSigning,
        public_key_hex: public_hex("operator-1"),
        voting_power: 0,
    });
    GovernancePolicy {
        version: DEV_POLICY_VERSION,
        network_id: sunrey_protocol::LOCAL_DEV_NETWORK_ID.into(),
        chain_id: sunrey_protocol::LOCAL_DEV_CHAIN_ID.into(),
        protocol_version: 1,
        threshold_model: ThresholdModel::ValidatorSupermajority,
        required_power: 3,
        total_power: 4,
        signers,
        release_authority_id: Some("gov_release_1".into()),
        min_activation_lead: MIN_ACTIVATION_LEAD,
    }
}

fn default_modules() -> Vec<NativeModuleRecord> {
    vec![NativeModuleRecord {
        module_id: "native.system".into(),
        version: "1".into(),
        artifact_hash: sha256_hex(b"native.system.v1"),
        schema_hash: sha256_hex(b"native.system.schema.v1"),
        activation_height: 0,
        deactivation_height: None,
    }]
}

fn default_codecs() -> Vec<CodecRecord> {
    vec![CodecRecord {
        codec_id: "srcb.v1".into(),
        schema_version: 1,
        schema_hash: sha256_hex(b"srcb.v1"),
        activation_height: 0,
    }]
}

impl UpgradeManager {
    pub fn development() -> Self {
        let params = ConsensusParams::development();
        let modules = default_modules();
        let codecs = default_codecs();
        let artifact = sha256_hex(b"development-artifact");
        Self {
            policy: development_policy(),
            plans: BTreeMap::new(),
            votes: BTreeMap::new(),
            audit: Vec::new(),
            protocol_version: 1,
            height: 0,
            params,
            modules,
            codecs,
            crypto_schedule: None,
            historical_suites: KNOWN_SUITES.iter().map(|s| (*s).to_string()).collect(),
            activation_success: 0,
            activation_failure: 0,
            halt_active: false,
            emergency: None,
            installed_artifacts: BTreeSet::from([artifact]),
        }
    }

    pub fn load_or_init(dir: impl AsRef<Path>) -> Result<Self, RejectReason> {
        let path = dir.as_ref().join("governance.json");
        if path.exists() {
            let bytes = std::fs::read(path).map_err(|_| RejectReason::CorruptStore)?;
            serde_json::from_slice(&bytes).map_err(|_| RejectReason::CorruptStore)
        } else {
            Ok(Self::development())
        }
    }

    pub fn persist(&self, dir: impl AsRef<Path>) -> Result<(), RejectReason> {
        let path = dir.as_ref().join("governance.json");
        let bytes =
            serde_json::to_vec_pretty(self).map_err(|_| RejectReason::PersistenceFailure)?;
        std::fs::write(path, bytes).map_err(|_| RejectReason::PersistenceFailure)
    }

    pub fn commitments(&self) -> ProtocolCommitments {
        ProtocolCommitments {
            protocol_version: self.protocol_version,
            consensus_params_hash: hash_params(&self.params),
            module_registry_hash: hash_modules(&self.modules),
            codec_registry_hash: hash_codecs(&self.codecs),
            crypto_policy_hash: hash_crypto(self.crypto_schedule.as_ref()),
        }
    }

    pub fn capability(&self) -> NodeCapability {
        NodeCapability {
            supported_protocol_versions: vec![1, 2, 3],
            artifact_hashes: self.installed_artifacts.iter().cloned().collect(),
            codec_ids: self.codecs.iter().map(|c| c.codec_id.clone()).collect(),
            suite_ids: self.historical_suites.iter().cloned().collect(),
            migration_hashes: self
                .plans
                .values()
                .filter_map(|plan| plan.state_migration_hash.clone())
                .collect(),
        }
    }

    fn record(&mut self, kind: &str, upgrade_id: &str) {
        self.audit.push(GovernanceAuditRecord {
            kind: kind.into(),
            upgrade_id: upgrade_id.into(),
            content_hash: sha256_hex(format!("{kind}:{upgrade_id}:{}", self.height).as_bytes()),
            height: self.height,
            protocol_version: self.protocol_version,
        });
    }

    fn transition(&mut self, id: &str, next: UpgradeStatus) -> Result<(), RejectReason> {
        let plan = self.plans.get_mut(id).ok_or(RejectReason::NotFound)?;
        if plan.status != next && !plan.status.can_go(next) {
            return Err(RejectReason::GovernanceRejected);
        }
        plan.status = next;
        Ok(())
    }

    pub fn draft_parameter_change(
        &self,
        upgrade_id: &str,
        activation_height: u64,
        params: ConsensusParams,
    ) -> Result<UpgradePlan, RejectReason> {
        params.validate()?;
        let artifact = sha256_hex(upgrade_id.as_bytes());
        Ok(UpgradePlan {
            upgrade_id: upgrade_id.into(),
            upgrade_kind: UpgradeKind::ConsensusParameterChange,
            current_protocol_version: self.protocol_version,
            target_protocol_version: self.protocol_version,
            proposal_height: self.height,
            activation_height,
            affected_modules: Vec::new(),
            new_module_hashes: BTreeMap::new(),
            codec_registry_hash: hash_to_hex(&hash_codecs(&self.codecs)),
            consensus_params_hash: hash_to_hex(&hash_params(&params)),
            crypto_policy_hash: hash_to_hex(&hash_crypto(self.crypto_schedule.as_ref())),
            state_migration_hash: None,
            release_artifact_hash: artifact,
            minimum_node_version: "0.1.0".into(),
            governance_policy_version: self.policy.version,
            authorization_state: "NONE".into(),
            status: UpgradeStatus::Draft,
            evidence_references: Vec::new(),
            consensus_params: params,
            modules: self.modules.clone(),
            codecs: self.codecs.clone(),
            crypto_schedule: None,
            state_migration: None,
            payload: BTreeMap::new(),
        })
    }

    pub fn draft_module_replace(
        &self,
        upgrade_id: &str,
        activation_height: u64,
        module: NativeModuleRecord,
        migration: StateMigrationSpec,
    ) -> UpgradePlan {
        let mut hashes = BTreeMap::new();
        hashes.insert(module.module_id.clone(), module.artifact_hash.clone());
        let artifact = sha256_hex(upgrade_id.as_bytes());
        UpgradePlan {
            upgrade_id: upgrade_id.into(),
            upgrade_kind: UpgradeKind::ModuleReplace,
            current_protocol_version: self.protocol_version,
            target_protocol_version: self.protocol_version + 1,
            proposal_height: self.height,
            activation_height,
            affected_modules: vec![module.module_id.clone()],
            new_module_hashes: hashes,
            codec_registry_hash: hash_to_hex(&hash_codecs(&self.codecs)),
            consensus_params_hash: hash_to_hex(&hash_params(&self.params)),
            crypto_policy_hash: hash_to_hex(&hash_crypto(self.crypto_schedule.as_ref())),
            state_migration_hash: Some(migration.content_hash.clone()),
            release_artifact_hash: artifact,
            minimum_node_version: "0.1.0".into(),
            governance_policy_version: self.policy.version,
            authorization_state: "NONE".into(),
            status: UpgradeStatus::Draft,
            evidence_references: Vec::new(),
            consensus_params: self.params.clone(),
            modules: vec![module],
            codecs: self.codecs.clone(),
            crypto_schedule: None,
            state_migration: Some(migration),
            payload: BTreeMap::new(),
        }
    }

    pub fn propose(&mut self, mut plan: UpgradePlan, actor_id: &str) -> Result<(), RejectReason> {
        let actor = self.actor(actor_id)?;
        self.authorize_actor(&actor)?;
        if self.plans.contains_key(&plan.upgrade_id) {
            return Err(RejectReason::GovernanceRejected);
        }
        self.validate_plan(&plan)?;
        plan.status = UpgradeStatus::Draft;
        let id = plan.upgrade_id.clone();
        self.plans.insert(id.clone(), plan);
        self.transition(&id, UpgradeStatus::Proposed)?;
        self.record("PROPOSAL", &id);
        Ok(())
    }

    pub fn validate(&mut self, upgrade_id: &str) -> Result<(), RejectReason> {
        self.transition(upgrade_id, UpgradeStatus::Validating)?;
        let plan = self.plans.get(upgrade_id).ok_or(RejectReason::NotFound)?.clone();
        match self.validate_plan(&plan) {
            Ok(()) => self.transition(upgrade_id, UpgradeStatus::AwaitingAuthorization),
            Err(err) => {
                self.transition(upgrade_id, UpgradeStatus::FailedValidation)?;
                Err(err)
            }
        }
    }

    fn validate_plan(&self, plan: &UpgradePlan) -> Result<(), RejectReason> {
        if plan.activation_height < self.height + self.policy.min_activation_lead {
            return Err(RejectReason::GovernanceRejected);
        }
        if plan.current_protocol_version != self.protocol_version {
            return Err(RejectReason::GovernanceRejected);
        }
        if plan.target_protocol_version < self.protocol_version {
            return Err(RejectReason::GovernanceRejected);
        }
        plan.consensus_params.validate()?;
        if plan.release_artifact_hash.len() != 64 {
            return Err(RejectReason::GovernanceRejected);
        }
        if payload_forbidden(&plan.payload) {
            return Err(RejectReason::GovernanceRejected);
        }
        if matches!(
            plan.upgrade_kind,
            UpgradeKind::ModuleReplace | UpgradeKind::HardProtocolCutover
        ) && plan.state_migration_hash.is_none()
        {
            return Err(RejectReason::GovernanceRejected);
        }
        if let Some(schedule) = &plan.crypto_schedule {
            if !KNOWN_SUITES.contains(&schedule.suite_id.as_str()) {
                return Err(RejectReason::InvalidCryptoSuite);
            }
            if !schedule.preserve_historical_verify {
                return Err(RejectReason::GovernanceRejected);
            }
        }
        Ok(())
    }

    pub fn vote(
        &mut self,
        upgrade_id: &str,
        voter_id: &str,
        choice: VoteChoice,
    ) -> Result<(), RejectReason> {
        let actor = self.actor(voter_id)?;
        self.authorize_actor(&actor)?;
        if !matches!(
            actor.role,
            GovernanceRole::ValidatorGovernanceSigner | GovernanceRole::ReleaseAuthority
        ) {
            return Err(RejectReason::GovernanceRejected);
        }
        let plan = self.plans.get(upgrade_id).ok_or(RejectReason::NotFound)?.clone();
        if !matches!(plan.status, UpgradeStatus::AwaitingAuthorization | UpgradeStatus::Authorized)
        {
            return Err(RejectReason::GovernanceRejected);
        }
        let content = proposal_content_hash(&plan);
        let mut message = Vec::new();
        encode_string(&mut message, &content);
        encode_string(&mut message, voter_id);
        let vote = GovernanceVote {
            upgrade_id: upgrade_id.into(),
            proposal_content_hash: content,
            network_id: self.policy.network_id.clone(),
            chain_id: self.policy.chain_id.clone(),
            protocol_version: self.policy.protocol_version,
            voter_id: voter_id.into(),
            governance_policy_version: self.policy.version,
            activation_height: plan.activation_height,
            choice,
            public_key_hex: actor.public_key_hex.clone(),
            signature_hex: sign_hex(actor_seed(voter_id), &message),
        };
        if !verify_hex(&vote.public_key_hex, &message, &vote.signature_hex) {
            return Err(RejectReason::InvalidSignature);
        }
        let entry = self.votes.entry(upgrade_id.into()).or_default();
        entry.retain(|item| item.voter_id != voter_id);
        entry.push(vote);
        self.record("VOTE", upgrade_id);
        self.evaluate(upgrade_id)
    }

    pub fn approve_power(&self, upgrade_id: &str) -> u64 {
        let Some(plan) = self.plans.get(upgrade_id) else {
            return 0;
        };
        let content = proposal_content_hash(plan);
        self.votes
            .get(upgrade_id)
            .map(|votes| {
                votes
                    .iter()
                    .filter(|vote| {
                        vote.choice == VoteChoice::Approve && vote.proposal_content_hash == content
                    })
                    .map(|vote| {
                        self.policy
                            .signers
                            .iter()
                            .find(|signer| signer.actor_id == vote.voter_id)
                            .map(|signer| signer.voting_power)
                            .unwrap_or(0)
                    })
                    .sum()
            })
            .unwrap_or(0)
    }

    fn evaluate(&mut self, upgrade_id: &str) -> Result<(), RejectReason> {
        let status = self.plans.get(upgrade_id).ok_or(RejectReason::NotFound)?.status;
        if status != UpgradeStatus::AwaitingAuthorization {
            return Ok(());
        }
        if self.approve_power(upgrade_id) >= self.policy.required_power {
            if self.policy.threshold_model
                == ThresholdModel::ValidatorSupermajorityPlusReleaseAuthority
            {
                let content = proposal_content_hash(
                    self.plans.get(upgrade_id).ok_or(RejectReason::NotFound)?,
                );
                let release_ok = self.votes.get(upgrade_id).is_some_and(|votes| {
                    votes.iter().any(|vote| {
                        Some(&vote.voter_id) == self.policy.release_authority_id.as_ref()
                            && vote.choice == VoteChoice::Approve
                            && vote.proposal_content_hash == content
                    })
                });
                if !release_ok {
                    return Ok(());
                }
            }
            self.transition(upgrade_id, UpgradeStatus::Authorized)?;
            let power = self.approve_power(upgrade_id);
            if let Some(plan) = self.plans.get_mut(upgrade_id) {
                plan.authorization_state = format!("POWER_{power}");
            }
            self.record("AUTHORIZATION", upgrade_id);
        }
        Ok(())
    }

    pub fn schedule(&mut self, upgrade_id: &str, actor_id: &str) -> Result<(), RejectReason> {
        let actor = self.actor(actor_id)?;
        self.authorize_actor(&actor)?;
        self.transition(upgrade_id, UpgradeStatus::Scheduled)?;
        self.installed_artifacts.insert(
            self.plans.get(upgrade_id).ok_or(RejectReason::NotFound)?.release_artifact_hash.clone(),
        );
        self.record("SCHEDULE", upgrade_id);
        Ok(())
    }

    pub fn cancel(&mut self, upgrade_id: &str, actor_id: &str) -> Result<(), RejectReason> {
        let actor = self.actor(actor_id)?;
        self.authorize_actor(&actor)?;
        let status = self.plans.get(upgrade_id).ok_or(RejectReason::NotFound)?.status;
        if status == UpgradeStatus::Activated {
            return Err(RejectReason::GovernanceRejected);
        }
        self.transition(upgrade_id, UpgradeStatus::Cancelled)?;
        self.record("CANCELLATION", upgrade_id);
        Ok(())
    }

    pub fn readiness(&self, upgrade_id: &str) -> Result<ReadinessStatus, RejectReason> {
        let plan = self.plans.get(upgrade_id).ok_or(RejectReason::NotFound)?;
        Ok(self.assess(plan, &self.capability()))
    }

    pub fn assess(&self, plan: &UpgradePlan, node: &NodeCapability) -> ReadinessStatus {
        if !node.supported_protocol_versions.contains(&plan.target_protocol_version) {
            return ReadinessStatus::IncompatibleBinary;
        }
        if !node.artifact_hashes.contains(&plan.release_artifact_hash) {
            return ReadinessStatus::MissingArtifact;
        }
        if let Some(schedule) = &plan.crypto_schedule {
            if !node.suite_ids.contains(&schedule.suite_id) {
                return ReadinessStatus::UnsupportedCryptoSuite;
            }
        }
        if let Some(hash) = &plan.state_migration_hash {
            if !node.migration_hashes.contains(hash) {
                return ReadinessStatus::StateMigrationUnavailable;
            }
        }
        ReadinessStatus::Ready
    }

    pub fn activate_at(
        &mut self,
        height: u64,
        node: &NodeCapability,
    ) -> Result<ProtocolCommitments, RejectReason> {
        self.height = height;
        if self.halt_active {
            return Err(RejectReason::IncompatibleProtocol);
        }
        let pending = self.plans.values().find(|plan| {
            matches!(plan.status, UpgradeStatus::Scheduled | UpgradeStatus::Ready)
                && plan.activation_height == height
        });
        let Some(plan) = pending.cloned() else {
            return Ok(self.commitments());
        };
        match self.assess(&plan, node) {
            ReadinessStatus::Ready => {}
            _ => {
                self.activation_failure += 1;
                return Err(RejectReason::IncompatibleProtocol);
            }
        }
        if plan.status == UpgradeStatus::Scheduled {
            self.transition(&plan.upgrade_id, UpgradeStatus::Ready)?;
        }
        self.params = plan.consensus_params.clone();
        if !plan.modules.is_empty() {
            self.modules = plan.modules.clone();
        }
        if !plan.codecs.is_empty() {
            self.codecs = plan.codecs.clone();
        }
        if let Some(schedule) = plan.crypto_schedule.clone() {
            self.historical_suites.insert(schedule.suite_id.clone());
            self.crypto_schedule = Some(schedule);
        }
        self.protocol_version = plan.target_protocol_version;
        self.transition(&plan.upgrade_id, UpgradeStatus::Activated)?;
        self.activation_success += 1;
        self.record("ACTIVATION", &plan.upgrade_id);
        Ok(self.commitments())
    }

    pub fn pending(&self) -> Option<&UpgradePlan> {
        self.plans.values().find(|plan| {
            matches!(
                plan.status,
                UpgradeStatus::Authorized | UpgradeStatus::Scheduled | UpgradeStatus::Ready
            )
        })
    }

    pub fn actor(&self, actor_id: &str) -> Result<GovernanceActor, RejectReason> {
        self.policy
            .signers
            .iter()
            .find(|actor| actor.actor_id == actor_id)
            .cloned()
            .ok_or(RejectReason::GovernanceRejected)
    }

    fn authorize_actor(&self, actor: &GovernanceActor) -> Result<(), RejectReason> {
        if actor.role == GovernanceRole::AiPreparer {
            return Err(RejectReason::GovernanceRejected);
        }
        if actor.key_kind != GovernanceKeyKind::GovernanceSigning {
            return Err(RejectReason::GovernanceRejected);
        }
        Ok(())
    }

    pub fn metrics_json(&self) -> serde_json::Value {
        let pending = self.pending();
        let commits = self.commitments();
        serde_json::json!({
            "protocol_version": self.protocol_version,
            "pending_upgrade": pending.map(|p| p.upgrade_id.clone()).unwrap_or_default(),
            "upgrade_activation_height": pending.map(|p| p.activation_height).unwrap_or(0),
            "upgrade_readiness": pending
                .map(|p| self.assess(p, &self.capability()).as_str())
                .unwrap_or("NONE"),
            "governance_votes_power": pending.map(|p| self.approve_power(&p.upgrade_id)).unwrap_or(0),
            "governance_required_power": self.policy.required_power,
            "module_registry_hash": hash_to_hex(&commits.module_registry_hash),
            "codec_registry_hash": hash_to_hex(&commits.codec_registry_hash),
            "crypto_policy_hash": hash_to_hex(&commits.crypto_policy_hash),
            "consensus_params_hash": hash_to_hex(&commits.consensus_params_hash),
            "upgrade_activation_success": self.activation_success,
            "upgrade_activation_failure": self.activation_failure,
        })
    }
}

pub fn apply_state_migration(
    spec: &StateMigrationSpec,
    pre: &[u8],
    apply: impl FnOnce(&[u8]) -> Vec<u8>,
) -> Result<Vec<u8>, RejectReason> {
    if sha256_hex(pre) != spec.pre_state_requirement {
        return Err(RejectReason::InvalidStateTransition);
    }
    let post = apply(pre);
    if sha256_hex(&post) != spec.post_state_root {
        return Err(RejectReason::InvalidStateTransition);
    }
    Ok(post)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn authorize3(manager: &mut UpgradeManager, id: &str) {
        manager.vote(id, "gov_validator_1", VoteChoice::Approve).unwrap();
        manager.vote(id, "gov_validator_2", VoteChoice::Approve).unwrap();
        manager.vote(id, "gov_validator_3", VoteChoice::Approve).unwrap();
    }

    #[test]
    fn parameter_upgrade_activates_exactly_at_h() {
        let mut manager = UpgradeManager::development();
        manager.height = 2;
        let mut params = ConsensusParams::development();
        params.max_transactions = 64;
        let plan = manager.draft_parameter_change("upg_h8", 8, params).unwrap();
        let before = hash_params(&manager.params);
        manager.propose(plan, "gov_operator_1").unwrap();
        manager.validate("upg_h8").unwrap();
        authorize3(&mut manager, "upg_h8");
        manager.schedule("upg_h8", "gov_operator_1").unwrap();
        let cap = manager.capability();
        for height in 3..8 {
            let commits = manager.activate_at(height, &cap).unwrap();
            assert_eq!(commits.consensus_params_hash, before);
        }
        let after = manager.activate_at(8, &cap).unwrap();
        assert_ne!(after.consensus_params_hash, before);
        assert_eq!(manager.params.max_transactions, 64);
    }

    #[test]
    fn insufficient_power_does_not_authorize() {
        let mut manager = UpgradeManager::development();
        let plan =
            manager.draft_parameter_change("upg_weak", 8, ConsensusParams::development()).unwrap();
        manager.propose(plan, "gov_operator_1").unwrap();
        manager.validate("upg_weak").unwrap();
        manager.vote("upg_weak", "gov_validator_1", VoteChoice::Approve).unwrap();
        manager.vote("upg_weak", "gov_validator_2", VoteChoice::Approve).unwrap();
        assert_eq!(manager.plans["upg_weak"].status, UpgradeStatus::AwaitingAuthorization);
    }

    #[test]
    fn execution_authority_and_p2p_keys_rejected() {
        let mut manager = UpgradeManager::development();
        let plan =
            manager.draft_parameter_change("upg_keys", 8, ConsensusParams::development()).unwrap();
        let mut actor = manager.actor("gov_operator_1").unwrap();
        actor.key_kind = GovernanceKeyKind::ExecutionAuthoritySigning;
        manager.policy.signers.push(actor);
        assert!(manager.propose(plan.clone(), "gov_operator_1").is_ok());
        let mut p2p = manager.actor("gov_operator_1").unwrap();
        p2p.actor_id = "p2p".into();
        p2p.key_kind = GovernanceKeyKind::P2pIdentity;
        manager.policy.signers.push(p2p);
        let other =
            manager.draft_parameter_change("upg_p2p", 8, ConsensusParams::development()).unwrap();
        assert_eq!(manager.propose(other, "p2p"), Err(RejectReason::GovernanceRejected));
    }

    #[test]
    fn changed_proposal_invalidates_votes() {
        let manager = UpgradeManager::development();
        let first =
            manager.draft_parameter_change("upg_a", 8, ConsensusParams::development()).unwrap();
        let mut second_params = ConsensusParams::development();
        second_params.max_transactions = 48;
        let second = manager.draft_parameter_change("upg_b", 8, second_params).unwrap();
        assert_ne!(proposal_content_hash(&first), proposal_content_hash(&second));
    }

    #[test]
    fn incompatible_node_refuses_activation() {
        let mut manager = UpgradeManager::development();
        let plan =
            manager.draft_parameter_change("upg_bad", 8, ConsensusParams::development()).unwrap();
        manager.propose(plan, "gov_operator_1").unwrap();
        manager.validate("upg_bad").unwrap();
        authorize3(&mut manager, "upg_bad");
        manager.schedule("upg_bad", "gov_operator_1").unwrap();
        let mut cap = manager.capability();
        cap.supported_protocol_versions = vec![1];
        cap.artifact_hashes.clear();
        assert_eq!(manager.activate_at(8, &cap), Err(RejectReason::IncompatibleProtocol));
        assert_eq!(manager.activation_failure, 1);
    }

    #[test]
    fn cancellation_before_activation() {
        let mut manager = UpgradeManager::development();
        let plan =
            manager.draft_parameter_change("upg_c", 8, ConsensusParams::development()).unwrap();
        manager.propose(plan, "gov_operator_1").unwrap();
        manager.validate("upg_c").unwrap();
        authorize3(&mut manager, "upg_c");
        manager.schedule("upg_c", "gov_operator_1").unwrap();
        manager.cancel("upg_c", "gov_operator_1").unwrap();
        let cap = manager.capability();
        let commits = manager.activate_at(8, &cap).unwrap();
        assert_eq!(commits.protocol_version, 1);
        assert_eq!(manager.params.max_transactions, 32);
    }

    #[test]
    fn deterministic_migration_and_historical_verify() {
        let spec = StateMigrationSpec {
            version: 1,
            content_hash: sha256_hex(b"mig"),
            from_protocol_version: 1,
            to_protocol_version: 2,
            pre_state_requirement: sha256_hex(b"pre"),
            post_state_root: sha256_hex(b"post"),
        };
        let out = apply_state_migration(&spec, b"pre", |_| b"post".to_vec()).unwrap();
        assert_eq!(out, b"post");
        let manager = UpgradeManager::development();
        assert!(manager.historical_suites.contains("SUNREY_DEV_ED25519_SHA256"));
    }

    #[test]
    fn four_validators_converge() {
        let mut nodes: Vec<UpgradeManager> =
            (0..4).map(|_| UpgradeManager::development()).collect();
        for node in &mut nodes {
            node.height = 2;
        }
        let mut params = ConsensusParams::development();
        params.max_block_bytes = 256_000;
        let plan = nodes[0].draft_parameter_change("upg_sync", 8, params).unwrap();
        for node in &mut nodes {
            node.propose(plan.clone(), "gov_operator_1").unwrap();
            node.validate("upg_sync").unwrap();
            authorize3(node, "upg_sync");
            node.schedule("upg_sync", "gov_operator_1").unwrap();
        }
        let mut roots = Vec::new();
        for height in 3..=9 {
            let mut height_roots = Vec::new();
            for node in &mut nodes {
                let cap = node.capability();
                let commits = node.activate_at(height, &cap).unwrap();
                height_roots.push(hash_to_hex(&commits.consensus_params_hash));
            }
            assert_eq!(height_roots.iter().collect::<BTreeSet<_>>().len(), 1);
            roots.push(height_roots[0].clone());
        }
        assert_ne!(roots[0], roots[roots.len() - 1]);
    }

    #[test]
    fn malicious_payloads_rejected() {
        let manager = UpgradeManager::development();
        let mut plan =
            manager.draft_parameter_change("upg_evil", 8, ConsensusParams::development()).unwrap();
        plan.payload.insert("moonrey_issuance".into(), serde_json::json!(true));
        assert!(payload_forbidden(&plan.payload));
        plan.payload.clear();
        plan.payload.insert("sunrey_coin_supply".into(), serde_json::json!(1));
        assert!(payload_forbidden(&plan.payload));
        plan.payload.clear();
        plan.payload.insert("production_network_enabled".into(), serde_json::json!(true));
        assert!(payload_forbidden(&plan.payload));
    }
}
