//! Write-ahead safety domains. These are not interchangeable.

/// Consensus WAL records votes, locks, and height/round progress. Rewinding it
/// can violate BFT safety. Owned by `sunrey-consensus`.
pub const CONSENSUS_WAL_KIND: &str = "CONSENSUS_WAL";

/// Application state commit is the atomic finalized-block transaction in the
/// production storage engine. It is not a consensus vote log.
pub const APPLICATION_STATE_COMMIT_KIND: &str = "APPLICATION_STATE_COMMIT";

/// Signer-safety database records the last signed (height, round, step).
/// Restoring a stale copy can cause double-signing. Owned by consensus/validators.
pub const SIGNER_SAFETY_DB_KIND: &str = "SIGNER_SAFETY_DB";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WalDomain {
    Consensus,
    ApplicationStateCommit,
    SignerSafety,
}

impl WalDomain {
    pub fn kind(self) -> &'static str {
        match self {
            Self::Consensus => CONSENSUS_WAL_KIND,
            Self::ApplicationStateCommit => APPLICATION_STATE_COMMIT_KIND,
            Self::SignerSafety => SIGNER_SAFETY_DB_KIND,
        }
    }

    pub fn security_property(self) -> &'static str {
        match self {
            Self::Consensus => {
                "append-only recovery of consensus progress; must not rewind below a known commit"
            }
            Self::ApplicationStateCommit => {
                "atomic finalized economic state; crash yields the previous or next valid commit, never a partial apply"
            }
            Self::SignerSafety => {
                "monotonic high-watermark; a stale restore is a double-sign hazard and must be rejected"
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn domains_are_distinct() {
        assert_ne!(WalDomain::Consensus.kind(), WalDomain::ApplicationStateCommit.kind());
        assert_ne!(WalDomain::ApplicationStateCommit.kind(), WalDomain::SignerSafety.kind());
        assert_ne!(WalDomain::Consensus.kind(), WalDomain::SignerSafety.kind());
    }
}
