use sunrey_crypto::CryptoError;
use sunrey_protocol::RejectReason;
use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ConsensusError {
    #[error("integer overflow in consensus arithmetic")]
    Overflow,
    #[error("invalid height")]
    InvalidHeight,
    #[error("invalid round")]
    InvalidRound,
    #[error("empty validator set")]
    EmptyValidatorSet,
    #[error("duplicate validator id")]
    DuplicateValidator,
    #[error("voting power must be a positive integer for an active validator")]
    InvalidVotingPower,
    #[error("unknown validator")]
    UnknownValidator,
    #[error("not the expected proposer for this height and round")]
    UnexpectedProposer,
    #[error("proposal rejected: {0}")]
    ProposalRejected(&'static str),
    #[error("vote rejected: {0}")]
    VoteRejected(&'static str),
    #[error("signer safety refused a conflicting signature")]
    SignerSafetyConflict,
    #[error("quorum not reached")]
    QuorumNotReached,
    #[error("nil cannot form a commit")]
    NilCommit,
    #[error("commit certificate invalid: {0}")]
    InvalidCertificate(&'static str),
    #[error("wal failure: {0}")]
    Wal(&'static str),
    #[error("application refused the proposal")]
    ApplicationInvalid,
    #[error("application apply failed")]
    ApplicationApply,
    #[error("wrong network or chain")]
    WrongNetwork,
    #[error("wrong protocol version")]
    WrongProtocolVersion,
    #[error("wrong validator-set hash")]
    WrongValidatorSetHash,
    #[error("wrong consensus-parameter hash")]
    WrongConsensusParamsHash,
    #[error("wrong parent")]
    WrongParent,
    #[error("block exceeds configured limits")]
    BlockLimit,
    #[error("timeout out of configured bounds")]
    TimeoutBounds,
    #[error("crypto: {0}")]
    Crypto(String),
    #[error("decode failed")]
    Decode,
    #[error("not a local validator")]
    NotLocalValidator,
    #[error("height already finalized")]
    AlreadyFinalized,
    #[error("consensus is not ready")]
    NotReady,
}

impl From<CryptoError> for ConsensusError {
    fn from(value: CryptoError) -> Self {
        ConsensusError::Crypto(value.to_string())
    }
}

impl From<RejectReason> for ConsensusError {
    fn from(_: RejectReason) -> Self {
        ConsensusError::Decode
    }
}
