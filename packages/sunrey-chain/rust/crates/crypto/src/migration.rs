//! Governable cryptographic migration states and per-role verification models.
//!
//! Transitions are reserved for protocol-upgrade machinery. Local configuration
//! cannot invent a weaker policy than the derived migration state.

use crate::{DEV_SUITE_ID, HYBRID_ED25519_MLDSA_SUITE_ID, ML_DSA_65_SUITE_ID, PROTOCOL_SUITE_ID};

/// Migration lifecycle aligned with `packages/security/src/crypto-migration.ts`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CryptoMigrationState {
    ClassicalOnly,
    HybridAvailable,
    HybridRequiredSelectedRoles,
    PqPrimary,
    LegacyVerifyOnly,
    LegacyRetired,
}

impl CryptoMigrationState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ClassicalOnly => "CLASSICAL_ONLY",
            Self::HybridAvailable => "HYBRID_AVAILABLE",
            Self::HybridRequiredSelectedRoles => "HYBRID_REQUIRED_SELECTED_ROLES",
            Self::PqPrimary => "PQ_PRIMARY",
            Self::LegacyVerifyOnly => "LEGACY_VERIFY_ONLY",
            Self::LegacyRetired => "LEGACY_RETIRED",
        }
    }
}

/// Roles that require hybrid signatures once `HybridRequiredSelectedRoles` is active.
pub const HYBRID_REQUIRED_ROLES: &[&str] = &[
    "VALIDATOR_CONSENSUS_SIGNING",
    "BLOCK_PROPOSAL_SIGNING",
    "GOVERNANCE_SIGNING",
    "ORACLE_SIGNING",
];

/// Height-activated schedule (testnet rehearsal defaults from TypeScript).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HeightActivatedCryptoSchedule {
    pub h1_hybrid_available: u64,
    pub h2_hybrid_required_selected_roles: u64,
    pub h3_pq_primary_selected_role: u64,
}

impl Default for HeightActivatedCryptoSchedule {
    fn default() -> Self {
        Self {
            h1_hybrid_available: 20,
            h2_hybrid_required_selected_roles: 40,
            h3_pq_primary_selected_role: 60,
        }
    }
}

pub fn migration_state_at_height(
    height: u64,
    schedule: &HeightActivatedCryptoSchedule,
) -> CryptoMigrationState {
    if height >= schedule.h3_pq_primary_selected_role {
        return CryptoMigrationState::PqPrimary;
    }
    if height >= schedule.h2_hybrid_required_selected_roles {
        return CryptoMigrationState::HybridRequiredSelectedRoles;
    }
    if height >= schedule.h1_hybrid_available {
        return CryptoMigrationState::HybridAvailable;
    }
    CryptoMigrationState::ClassicalOnly
}

/// Cryptographic operation category for migration model selection.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CryptoOperationCategory {
    TransactionAuthorization,
    WalletAccountSigning,
    ValidatorSigning,
    ConsensusMessageSigning,
    NodeIdentity,
    PeerSessionSecurity,
    BlockSigning,
    Hashing,
    MerkleStateCommitments,
    Encryption,
    InteropSigning,
    TestOnly,
}

/// Recommended verification model per category.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MigrationVerificationModel {
    /// Accept classical OR PQC (whichever matches descriptor).
    ClassicalOrPq,
    /// Require both classical AND PQ components (hybrid).
    ClassicalAndPq,
    /// Policy depends on artifact version field.
    VersionDependent,
    /// Policy depends on finalized chain height.
    ActivationHeightDependent,
}

pub fn recommended_verification_model(
    category: CryptoOperationCategory,
) -> MigrationVerificationModel {
    match category {
        CryptoOperationCategory::TransactionAuthorization
        | CryptoOperationCategory::WalletAccountSigning => {
            MigrationVerificationModel::VersionDependent
        }
        CryptoOperationCategory::ValidatorSigning
        | CryptoOperationCategory::ConsensusMessageSigning
        | CryptoOperationCategory::BlockSigning => {
            MigrationVerificationModel::ActivationHeightDependent
        }
        CryptoOperationCategory::NodeIdentity | CryptoOperationCategory::PeerSessionSecurity => {
            MigrationVerificationModel::ClassicalOrPq
        }
        CryptoOperationCategory::InteropSigning => MigrationVerificationModel::VersionDependent,
        CryptoOperationCategory::Hashing | CryptoOperationCategory::MerkleStateCommitments => {
            MigrationVerificationModel::VersionDependent
        }
        CryptoOperationCategory::Encryption => MigrationVerificationModel::ClassicalOrPq,
        CryptoOperationCategory::TestOnly => MigrationVerificationModel::ClassicalOrPq,
    }
}

pub fn historical_verify_allowed(suite_id: &str) -> bool {
    matches!(
        suite_id,
        PROTOCOL_SUITE_ID
            | DEV_SUITE_ID
            | HYBRID_ED25519_MLDSA_SUITE_ID
            | ML_DSA_65_SUITE_ID
            | "sunrey-hybrid-ed25519-mldsa-sim-v1"
    )
}

pub fn role_accepts_suite_for_sign(
    state: CryptoMigrationState,
    purpose: &str,
    suite_id: &str,
) -> bool {
    match state {
        CryptoMigrationState::ClassicalOnly => {
            suite_id == PROTOCOL_SUITE_ID || suite_id == DEV_SUITE_ID
        }
        CryptoMigrationState::HybridAvailable => {
            matches!(
                suite_id,
                PROTOCOL_SUITE_ID
                    | DEV_SUITE_ID
                    | HYBRID_ED25519_MLDSA_SUITE_ID
                    | ML_DSA_65_SUITE_ID
            )
        }
        CryptoMigrationState::HybridRequiredSelectedRoles => {
            if HYBRID_REQUIRED_ROLES.contains(&purpose) {
                suite_id == HYBRID_ED25519_MLDSA_SUITE_ID
            } else {
                matches!(suite_id, PROTOCOL_SUITE_ID | DEV_SUITE_ID | HYBRID_ED25519_MLDSA_SUITE_ID)
            }
        }
        CryptoMigrationState::PqPrimary => {
            matches!(
                suite_id,
                PROTOCOL_SUITE_ID
                    | DEV_SUITE_ID
                    | HYBRID_ED25519_MLDSA_SUITE_ID
                    | ML_DSA_65_SUITE_ID
            )
        }
        CryptoMigrationState::LegacyVerifyOnly => {
            matches!(suite_id, HYBRID_ED25519_MLDSA_SUITE_ID | ML_DSA_65_SUITE_ID)
        }
        CryptoMigrationState::LegacyRetired => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migration_state_derives_from_height() {
        let schedule = HeightActivatedCryptoSchedule::default();
        assert_eq!(migration_state_at_height(0, &schedule), CryptoMigrationState::ClassicalOnly);
        assert_eq!(migration_state_at_height(25, &schedule), CryptoMigrationState::HybridAvailable);
        assert_eq!(
            migration_state_at_height(45, &schedule),
            CryptoMigrationState::HybridRequiredSelectedRoles
        );
        assert_eq!(migration_state_at_height(70, &schedule), CryptoMigrationState::PqPrimary);
    }

    #[test]
    fn validator_role_requires_hybrid_at_hybrid_required_state() {
        assert!(role_accepts_suite_for_sign(
            CryptoMigrationState::HybridRequiredSelectedRoles,
            "VALIDATOR_CONSENSUS_SIGNING",
            HYBRID_ED25519_MLDSA_SUITE_ID,
        ));
        assert!(!role_accepts_suite_for_sign(
            CryptoMigrationState::HybridRequiredSelectedRoles,
            "VALIDATOR_CONSENSUS_SIGNING",
            PROTOCOL_SUITE_ID,
        ));
    }

    #[test]
    fn classical_transactions_remain_signable_in_classical_only() {
        assert!(role_accepts_suite_for_sign(
            CryptoMigrationState::ClassicalOnly,
            "TRANSACTION_SIGNING",
            PROTOCOL_SUITE_ID,
        ));
    }

    #[test]
    fn legacy_retired_rejects_all_signing() {
        assert!(!role_accepts_suite_for_sign(
            CryptoMigrationState::LegacyRetired,
            "TRANSACTION_SIGNING",
            PROTOCOL_SUITE_ID,
        ));
    }
}
