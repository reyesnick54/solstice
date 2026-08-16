use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RejectReason {
    DecodeFailed,
    WrongNetwork,
    WrongChain,
    SchemaInvalid,
    SizeExceeded,
    InvalidCryptoSuite,
    InvalidSignatureDescriptor,
    InvalidSignature,
    Replay,
    StatelessInvalid,
    StatefulInvalid,
    QueueFull,
    TransactionNotActivated,
    UnsupportedVersion,
    IncorrectParent,
    IncorrectHeight,
    WrongTransactionRoot,
    WrongStateRoot,
    DuplicateTransaction,
    InvalidStateTransition,
    CorruptStore,
    PersistenceFailure,
    NotFound,
    NotReady,
    IncompatibleProtocol,
    GovernanceRejected,
    OracleRejected,
    InsufficientAsset,
    AssetLocked,
    UnauthorizedIssuance,
    IssuanceReplay,
    Overflow,
    SupplyInconsistency,
    FaucetForbidden,
    PolicyDenied,
    CrossAssetArithmetic,
    OutOfExecutionUnits,
    InsufficientFee,
    UnsupportedFeeAsset,
}

impl RejectReason {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::DecodeFailed => "DECODE_FAILED",
            Self::WrongNetwork => "WRONG_NETWORK",
            Self::WrongChain => "WRONG_CHAIN",
            Self::SchemaInvalid => "SCHEMA_INVALID",
            Self::SizeExceeded => "SIZE_EXCEEDED",
            Self::InvalidCryptoSuite => "INVALID_CRYPTO_SUITE",
            Self::InvalidSignatureDescriptor => "INVALID_SIGNATURE_DESCRIPTOR",
            Self::InvalidSignature => "INVALID_SIGNATURE",
            Self::Replay => "REPLAY",
            Self::StatelessInvalid => "STATELESS_INVALID",
            Self::StatefulInvalid => "STATEFUL_INVALID",
            Self::QueueFull => "QUEUE_FULL",
            Self::TransactionNotActivated => "TRANSACTION_NOT_ACTIVATED",
            Self::UnsupportedVersion => "UNSUPPORTED_VERSION",
            Self::IncorrectParent => "INCORRECT_PARENT",
            Self::IncorrectHeight => "INCORRECT_HEIGHT",
            Self::WrongTransactionRoot => "WRONG_TRANSACTION_ROOT",
            Self::WrongStateRoot => "WRONG_STATE_ROOT",
            Self::DuplicateTransaction => "DUPLICATE_TRANSACTION",
            Self::InvalidStateTransition => "INVALID_STATE_TRANSITION",
            Self::CorruptStore => "CORRUPT_STORE",
            Self::PersistenceFailure => "PERSISTENCE_FAILURE",
            Self::NotFound => "NOT_FOUND",
            Self::NotReady => "NOT_READY",
            Self::IncompatibleProtocol => "INCOMPATIBLE_PROTOCOL",
            Self::GovernanceRejected => "GOVERNANCE_REJECTED",
            Self::OracleRejected => "ORACLE_REJECTED",
            Self::InsufficientAsset => "INSUFFICIENT_ASSET",
            Self::AssetLocked => "ASSET_LOCKED",
            Self::UnauthorizedIssuance => "UNAUTHORIZED_ISSUANCE",
            Self::IssuanceReplay => "ISSUANCE_REPLAY",
            Self::Overflow => "OVERFLOW",
            Self::SupplyInconsistency => "SUPPLY_INCONSISTENCY",
            Self::FaucetForbidden => "FAUCET_FORBIDDEN",
            Self::PolicyDenied => "POLICY_DENIED",
            Self::CrossAssetArithmetic => "CROSS_ASSET_ARITHMETIC",
            Self::OutOfExecutionUnits => "OUT_OF_EXECUTION_UNITS",
            Self::InsufficientFee => "INSUFFICIENT_FEE",
            Self::UnsupportedFeeAsset => "UNSUPPORTED_FEE_ASSET",
        }
    }
}

impl std::fmt::Display for RejectReason {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl std::error::Error for RejectReason {}
