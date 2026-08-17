use sunrey_protocol::RejectReason;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AssetError {
    DecodeFailed,
    SchemaInvalid,
    CrossAssetArithmetic,
    Overflow,
    InsufficientAsset,
    AssetLocked,
    UnauthorizedIssuance,
    IssuanceReplay,
    SupplyInconsistency,
    FaucetForbidden,
    PolicyDenied,
    WrongNetwork,
    WrongChain,
    InvalidCryptoSuite,
    InvalidSignature,
    StatelessInvalid,
    StatefulInvalid,
    AssetUnknown,
    AssetInactive,
    QuantityZero,
    QuantityExceedsMaximum,
    LockNotFound,
    LockNotOwned,
    AuthorizationExpired,
    WrongAuthority,
    UnauthorizedSettlement,
    SettlementReplay,
    TradeAlreadySettled,
    WrongAsset,
    InsufficientReservation,
    ReservationMismatch,
    BatchLimitExceeded,
}

impl AssetError {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::DecodeFailed => "DECODE_FAILED",
            Self::SchemaInvalid => "SCHEMA_INVALID",
            Self::CrossAssetArithmetic => "CROSS_ASSET_ARITHMETIC",
            Self::Overflow => "OVERFLOW",
            Self::InsufficientAsset => "INSUFFICIENT_ASSET",
            Self::AssetLocked => "ASSET_LOCKED",
            Self::UnauthorizedIssuance => "UNAUTHORIZED_ISSUANCE",
            Self::IssuanceReplay => "ISSUANCE_REPLAY",
            Self::SupplyInconsistency => "SUPPLY_INCONSISTENCY",
            Self::FaucetForbidden => "FAUCET_FORBIDDEN",
            Self::PolicyDenied => "POLICY_DENIED",
            Self::WrongNetwork => "WRONG_NETWORK",
            Self::WrongChain => "WRONG_CHAIN",
            Self::InvalidCryptoSuite => "INVALID_CRYPTO_SUITE",
            Self::InvalidSignature => "INVALID_SIGNATURE",
            Self::StatelessInvalid => "STATELESS_INVALID",
            Self::StatefulInvalid => "STATEFUL_INVALID",
            Self::AssetUnknown => "ASSET_UNKNOWN",
            Self::AssetInactive => "ASSET_INACTIVE",
            Self::QuantityZero => "QUANTITY_ZERO",
            Self::QuantityExceedsMaximum => "QUANTITY_EXCEEDS_MAXIMUM",
            Self::LockNotFound => "LOCK_NOT_FOUND",
            Self::LockNotOwned => "LOCK_NOT_OWNED",
            Self::AuthorizationExpired => "AUTHORIZATION_EXPIRED",
            Self::WrongAuthority => "WRONG_AUTHORITY",
            Self::UnauthorizedSettlement => "UNAUTHORIZED_SETTLEMENT",
            Self::SettlementReplay => "SETTLEMENT_REPLAY",
            Self::TradeAlreadySettled => "TRADE_ALREADY_SETTLED",
            Self::WrongAsset => "WRONG_ASSET",
            Self::InsufficientReservation => "INSUFFICIENT_RESERVATION",
            Self::ReservationMismatch => "RESERVATION_MISMATCH",
            Self::BatchLimitExceeded => "BATCH_LIMIT_EXCEEDED",
        }
    }

    pub fn to_reject(self) -> RejectReason {
        match self {
            Self::DecodeFailed => RejectReason::DecodeFailed,
            Self::SchemaInvalid => RejectReason::SchemaInvalid,
            Self::CrossAssetArithmetic => RejectReason::CrossAssetArithmetic,
            Self::Overflow => RejectReason::Overflow,
            Self::InsufficientAsset => RejectReason::InsufficientAsset,
            Self::AssetLocked => RejectReason::AssetLocked,
            Self::UnauthorizedIssuance => RejectReason::UnauthorizedIssuance,
            Self::IssuanceReplay => RejectReason::IssuanceReplay,
            Self::SupplyInconsistency => RejectReason::SupplyInconsistency,
            Self::FaucetForbidden => RejectReason::FaucetForbidden,
            Self::PolicyDenied => RejectReason::PolicyDenied,
            Self::WrongNetwork => RejectReason::WrongNetwork,
            Self::WrongChain => RejectReason::WrongChain,
            Self::InvalidCryptoSuite => RejectReason::InvalidCryptoSuite,
            Self::InvalidSignature => RejectReason::InvalidSignature,
            Self::StatelessInvalid | Self::QuantityZero | Self::QuantityExceedsMaximum => {
                RejectReason::StatelessInvalid
            }
            Self::StatefulInvalid
            | Self::AssetUnknown
            | Self::LockNotFound
            | Self::LockNotOwned
            | Self::AuthorizationExpired
            | Self::WrongAuthority
            | Self::UnauthorizedSettlement
            | Self::SettlementReplay
            | Self::TradeAlreadySettled
            | Self::InsufficientReservation
            | Self::ReservationMismatch
            | Self::BatchLimitExceeded => RejectReason::StatefulInvalid,
            Self::WrongAsset => RejectReason::CrossAssetArithmetic,
            Self::AssetInactive => RejectReason::PolicyDenied,
        }
    }
}

impl std::fmt::Display for AssetError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl std::error::Error for AssetError {}

impl From<AssetError> for RejectReason {
    fn from(value: AssetError) -> Self {
        value.to_reject()
    }
}
