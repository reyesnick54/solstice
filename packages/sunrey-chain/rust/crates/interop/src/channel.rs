use serde::{Deserialize, Serialize};

use crate::error::InteropError;
use crate::ids::{InterchainChannelId, InterchainConnectionId};
use crate::types::{ChannelOrdering, ChannelType, ConnectionState};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterchainChannel {
    pub channel_id: InterchainChannelId,
    pub connection_id: InterchainConnectionId,
    pub channel_type: ChannelType,
    pub ordering: ChannelOrdering,
    pub state: ConnectionState,
    pub next_send_sequence: u64,
    pub next_recv_sequence: u64,
    pub governed: bool,
}

impl InterchainChannel {
    pub fn require_open(&self) -> Result<(), InteropError> {
        if self.state == ConnectionState::Open {
            Ok(())
        } else {
            Err(InteropError::ChannelNotFoundOpen)
        }
    }

    pub fn require_type(&self, expected: ChannelType) -> Result<(), InteropError> {
        if self.channel_type == expected {
            Ok(())
        } else {
            Err(InteropError::PacketTypeDenied)
        }
    }

    pub fn require_governed_if_high_risk(&self) -> Result<(), InteropError> {
        if self.channel_type.high_risk() && !self.governed {
            Err(InteropError::GovernanceRequired)
        } else {
            Ok(())
        }
    }
}
