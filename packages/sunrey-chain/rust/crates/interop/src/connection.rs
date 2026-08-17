use serde::{Deserialize, Serialize};

use crate::error::InteropError;
use crate::ids::{InterchainClientId, InterchainConnectionId};
use crate::types::{ConnectionState, InteropCapability};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterchainConnection {
    pub connection_id: InterchainConnectionId,
    pub source_client: InterchainClientId,
    pub destination_client: InterchainClientId,
    pub protocol_version: String,
    pub capabilities: Vec<InteropCapability>,
    pub proof_requirement: String,
    pub state: ConnectionState,
}

impl InterchainConnection {
    pub fn step(&mut self, next: ConnectionState) -> Result<(), InteropError> {
        let allowed = matches!(
            (self.state, next),
            (ConnectionState::Init, ConnectionState::Try)
                | (ConnectionState::Try, ConnectionState::Ack)
                | (ConnectionState::Ack, ConnectionState::Confirm)
                | (ConnectionState::Confirm, ConnectionState::Open)
        );
        if !allowed {
            return Err(InteropError::ConnectionHandshakeInvalid);
        }
        self.state = next;
        if next == ConnectionState::Confirm {
            self.state = ConnectionState::Open;
        }
        Ok(())
    }

    pub fn require_open(&self) -> Result<(), InteropError> {
        if self.state == ConnectionState::Open {
            Ok(())
        } else {
            Err(InteropError::ConnectionHandshakeInvalid)
        }
    }
}
