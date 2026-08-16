use serde::{Deserialize, Serialize};

use crate::error::ConsensusError;
use sunrey_protocol::Hash32;

/// Canonical consensus height. Genesis is 0; the first proposed block is 1.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Height(u64);

impl Height {
    pub const GENESIS: Self = Self(0);
    pub const FIRST: Self = Self(1);

    pub const fn new(raw: u64) -> Self {
        Self(raw)
    }

    pub const fn get(self) -> u64 {
        self.0
    }

    pub fn increment(self) -> Result<Self, ConsensusError> {
        self.0.checked_add(1).map(Self).ok_or(ConsensusError::Overflow)
    }

    pub fn saturating_minus_one(self) -> u64 {
        self.0.saturating_sub(1)
    }
}

impl From<u64> for Height {
    fn from(value: u64) -> Self {
        Self(value)
    }
}

/// Tendermint-class round. Starts at 0 for each height.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Round(u32);

impl Round {
    pub const ZERO: Self = Self(0);

    pub const fn new(raw: u32) -> Self {
        Self(raw)
    }

    pub const fn get(self) -> u32 {
        self.0
    }

    pub fn increment(self) -> Result<Self, ConsensusError> {
        self.0.checked_add(1).map(Self).ok_or(ConsensusError::Overflow)
    }

    pub fn checked_add(self, delta: u32) -> Result<Self, ConsensusError> {
        self.0.checked_add(delta).map(Self).ok_or(ConsensusError::Overflow)
    }
}

impl From<u32> for Round {
    fn from(value: u32) -> Self {
        Self(value)
    }
}

/// SunRey consensus step names around the Tendermint cycle.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ConsensusStep {
    NewHeight,
    Propose,
    Prevote,
    Precommit,
    Commit,
    Finalized,
}

impl ConsensusStep {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::NewHeight => "NEW_HEIGHT",
            Self::Propose => "PROPOSE",
            Self::Prevote => "PREVOTE",
            Self::Precommit => "PRECOMMIT",
            Self::Commit => "COMMIT",
            Self::Finalized => "FINALIZED",
        }
    }

    pub fn rank(self) -> u8 {
        match self {
            Self::NewHeight => 0,
            Self::Propose => 1,
            Self::Prevote => 2,
            Self::Precommit => 3,
            Self::Commit => 4,
            Self::Finalized => 5,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum VoteType {
    Prevote,
    Precommit,
}

impl VoteType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Prevote => "PREVOTE",
            Self::Precommit => "PRECOMMIT",
        }
    }

    pub fn from_u8(value: u8) -> Result<Self, ConsensusError> {
        match value {
            1 => Ok(Self::Prevote),
            2 => Ok(Self::Precommit),
            _ => Err(ConsensusError::Decode),
        }
    }

    pub fn to_u8(self) -> u8 {
        match self {
            Self::Prevote => 1,
            Self::Precommit => 2,
        }
    }
}

/// Block identifier. All-zero is reserved for NIL and cannot commit.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct BlockId(pub Hash32);

impl BlockId {
    pub const NIL: Self = Self([0u8; 32]);

    pub fn is_nil(self) -> bool {
        self.0 == [0u8; 32]
    }

    pub fn hex(self) -> String {
        hex::encode(self.0)
    }

    pub fn from_bytes(bytes: Hash32) -> Self {
        Self(bytes)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct ValidatorId(pub String);

impl ValidatorId {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl From<&str> for ValidatorId {
    fn from(value: &str) -> Self {
        Self(value.to_string())
    }
}

impl From<String> for ValidatorId {
    fn from(value: String) -> Self {
        Self(value)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ProposalId(pub Hash32);

impl ProposalId {
    pub fn hex(self) -> String {
        hex::encode(self.0)
    }
}

/// Tendermint `lockedValue` / `lockedRound`. `round = None` is −1 (unlocked).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct LockedValue {
    pub value: Option<BlockId>,
    pub round: Option<Round>,
}

impl LockedValue {
    pub fn unlocked() -> Self {
        Self { value: None, round: None }
    }

    pub fn is_unlocked(&self) -> bool {
        self.round.is_none()
    }
}

/// Tendermint `validValue` / `validRound`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ValidValue {
    pub value: Option<BlockId>,
    pub round: Option<Round>,
}

impl ValidValue {
    pub fn none() -> Self {
        Self { value: None, round: None }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RoundState {
    pub height: Height,
    pub round: Round,
    pub step: ConsensusStep,
    pub locked: LockedValue,
    pub valid: ValidValue,
    pub proposal_id: Option<ProposalId>,
    pub decision: Option<BlockId>,
}

impl RoundState {
    pub fn new_height(height: Height) -> Self {
        Self {
            height,
            round: Round::ZERO,
            step: ConsensusStep::NewHeight,
            locked: LockedValue::unlocked(),
            valid: ValidValue::none(),
            proposal_id: None,
            decision: None,
        }
    }
}
