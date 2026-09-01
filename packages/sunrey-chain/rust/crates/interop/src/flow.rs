//! Inbound and outbound interoperability flows.
//!
//! Outbound failures must not corrupt SunRey settlement state.

use serde::{Deserialize, Serialize};

use crate::envelope::{InteropFlowDirection, InteropMessageEnvelope};
use crate::error::InteropError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FlowAuthorization {
    ObservedOnly,
    VerifiedInbound,
    AuthorizedOutbound,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct InboundFlowState {
    pub observations: u64,
    pub verified: u64,
    pub executed: u64,
    pub rejected: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OutboundFlowState {
    pub prepared: u64,
    pub submitted: u64,
    pub failed: u64,
    pub settlement_committed: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct InteropFlowLedger {
    pub inbound: InboundFlowState,
    pub outbound: OutboundFlowState,
}

impl InteropFlowLedger {
    pub fn record_inbound_observation(&mut self) {
        self.inbound.observations += 1;
    }

    pub fn record_inbound_verified(&mut self) {
        self.inbound.verified += 1;
    }

    pub fn record_inbound_executed(&mut self) {
        self.inbound.executed += 1;
    }

    pub fn record_inbound_rejected(&mut self) {
        self.inbound.rejected += 1;
    }

    pub fn prepare_outbound(&mut self, envelope: &InteropMessageEnvelope) -> Result<(), InteropError> {
        if envelope.direction != InteropFlowDirection::Outbound {
            return Err(InteropError::SchemaInvalid);
        }
        self.outbound.prepared += 1;
        Ok(())
    }

    pub fn outbound_submitted(&mut self) {
        self.outbound.submitted += 1;
    }

    /// Outbound failure rolls back outbound counters only; settlement stays untouched.
    pub fn outbound_failed(&mut self) -> Result<(), InteropError> {
        if self.outbound.settlement_committed {
            return Err(InteropError::OutboundSettlementCorruption);
        }
        self.outbound.failed += 1;
        if self.outbound.prepared > 0 {
            self.outbound.prepared -= 1;
        }
        Ok(())
    }

    pub fn commit_outbound_settlement(&mut self) {
        self.outbound.settlement_committed = true;
    }
}

pub fn authorize_flow(direction: InteropFlowDirection, verified: bool) -> FlowAuthorization {
    match (direction, verified) {
        (InteropFlowDirection::Inbound, false) => FlowAuthorization::ObservedOnly,
        (InteropFlowDirection::Inbound, true) => FlowAuthorization::VerifiedInbound,
        (InteropFlowDirection::Outbound, true) => FlowAuthorization::AuthorizedOutbound,
        (InteropFlowDirection::Outbound, false) => FlowAuthorization::ObservedOnly,
    }
}
