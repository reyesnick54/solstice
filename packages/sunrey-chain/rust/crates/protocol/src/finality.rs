//! Canonical transaction finality observed by application layers.
//!
//! Local node height is not network finality. FINALIZED requires a
//! quorum commit certificate from the BFT engine.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TransactionFinality {
    Pending,
    Included,
    Finalized,
    Failed,
}

impl TransactionFinality {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "PENDING",
            Self::Included => "INCLUDED",
            Self::Finalized => "FINALIZED",
            Self::Failed => "FAILED",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FinalitySource {
    Mempool,
    LocalBlockObservation,
    CommitCertificate,
    Rejection,
}

impl FinalitySource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Mempool => "MEMPOOL",
            Self::LocalBlockObservation => "LOCAL_BLOCK_OBSERVATION",
            Self::CommitCertificate => "COMMIT_CERTIFICATE",
            Self::Rejection => "REJECTION",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TransactionObservation {
    pub tx_id: String,
    pub status: TransactionFinality,
    pub source: FinalitySource,
    pub height: Option<u64>,
    pub local_observation_is_not_finality: bool,
}

pub fn classify_finality(source: FinalitySource) -> TransactionFinality {
    match source {
        FinalitySource::Mempool => TransactionFinality::Pending,
        FinalitySource::LocalBlockObservation => TransactionFinality::Included,
        FinalitySource::CommitCertificate => TransactionFinality::Finalized,
        FinalitySource::Rejection => TransactionFinality::Failed,
    }
}

pub fn observe(
    tx_id: impl Into<String>,
    source: FinalitySource,
    height: Option<u64>,
) -> TransactionObservation {
    let status = classify_finality(source);
    TransactionObservation {
        tx_id: tx_id.into(),
        status,
        source,
        height,
        local_observation_is_not_finality: source != FinalitySource::CommitCertificate,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_observation_is_included_not_finalized() {
        let observed = observe("tx1", FinalitySource::LocalBlockObservation, Some(4));
        assert_eq!(observed.status, TransactionFinality::Included);
        assert!(observed.local_observation_is_not_finality);
    }

    #[test]
    fn commit_certificate_is_finalized() {
        let observed = observe("tx1", FinalitySource::CommitCertificate, Some(4));
        assert_eq!(observed.status, TransactionFinality::Finalized);
        assert!(!observed.local_observation_is_not_finality);
    }

    #[test]
    fn mempool_is_pending_and_rejection_is_failed() {
        assert_eq!(classify_finality(FinalitySource::Mempool), TransactionFinality::Pending);
        assert_eq!(classify_finality(FinalitySource::Rejection), TransactionFinality::Failed);
    }
}
