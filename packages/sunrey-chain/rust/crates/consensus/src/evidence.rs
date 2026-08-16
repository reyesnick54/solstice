use serde::{Deserialize, Serialize};

use crate::message::{Proposal, Vote};
use crate::types::ValidatorId;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Evidence {
    DoubleProposal { validator_id: ValidatorId, first: Box<Proposal>, second: Box<Proposal> },
    DoublePrevote { validator_id: ValidatorId, first: Vote, second: Vote },
    DoublePrecommit { validator_id: ValidatorId, first: Vote, second: Vote },
}

impl Evidence {
    pub fn validator_id(&self) -> &ValidatorId {
        match self {
            Self::DoubleProposal { validator_id, .. }
            | Self::DoublePrevote { validator_id, .. }
            | Self::DoublePrecommit { validator_id, .. } => validator_id,
        }
    }
}
