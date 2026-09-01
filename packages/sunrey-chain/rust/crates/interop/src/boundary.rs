//! Observation → Verification → Execution boundary.
//!
//! Never trust relayer-provided business data directly.

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::activation::InteropActivationGate;
use crate::circuit_breaker::InteropCircuitBreakers;
use crate::encoding::hex_hash;
use crate::engine::InteropEngine;
use crate::envelope::InteropMessageEnvelope;
use crate::error::InteropError;
use crate::packet::InterchainPacket;
use crate::registry::ExternalChainDefinition;
use crate::relayer::IsolatedRelayer;
use crate::types::ChannelType;
use crate::watcher::WatcherObservation;
use crate::INTEROP_PROTOCOL_VERSION;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ValidationPhase {
    Observation,
    Verification,
    Execution,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifiedInteropMessage {
    pub envelope_digest: String,
    pub replay_key: String,
    pub packet: InterchainPacket,
    pub phase: ValidationPhase,
}

pub struct InteropBoundary<'a> {
    pub engine: &'a mut InteropEngine,
    pub activation: &'a InteropActivationGate,
    pub circuits: &'a mut InteropCircuitBreakers,
    pub consumed: &'a mut BTreeSet<String>,
}

impl InteropBoundary<'_> {
    pub fn observe(&self, _observation: &WatcherObservation) -> Result<(), InteropError> {
        self.activation.require_development()
    }

    pub fn verify_envelope(
        &mut self,
        envelope: &InteropMessageEnvelope,
        payload: &[u8],
        chain: &ExternalChainDefinition,
        relayer: &IsolatedRelayer,
    ) -> Result<VerifiedInteropMessage, InteropError> {
        let _ = relayer.relayer_id.as_str();
        self.activation.require_development()?;
        envelope.validate_structure(self.engine.now_unix, self.engine.sunrey_height)?;
        if envelope.protocol_version != INTEROP_PROTOCOL_VERSION {
            return Err(InteropError::UnsupportedMessageVersion);
        }
        if envelope.source_chain_id != chain.external_chain_id {
            return Err(InteropError::WrongExternalChainId);
        }
        chain.require_usable()?;
        let payload_commitment = crate::encoding::domain_hash(crate::DOMAIN_PACKET, payload);
        if payload_commitment != envelope.payload_hash {
            return Err(InteropError::ModifiedPacket);
        }
        let cap = match envelope.message_type {
            ChannelType::GenericMessage => crate::types::InteropCapability::GenericMessage,
            ChannelType::EconomicAttestation => {
                crate::types::InteropCapability::EconomicAttestation
            }
            ChannelType::AssetTransferReserved => {
                crate::types::InteropCapability::AssetTransferDevOnly
            }
            ChannelType::OracleFact => crate::types::InteropCapability::OracleFact,
            ChannelType::IdentityAttestationReserved => {
                crate::types::InteropCapability::IdentityAttestation
            }
        };
        chain.allows(cap)?;
        self.circuits.guard_message(
            &envelope.source_network,
            Some(envelope.message_type.as_str()),
            0,
        )?;
        let replay_key = hex_hash(&envelope.replay_key());
        if self.consumed.contains(&replay_key) {
            return Err(InteropError::PacketReplay);
        }
        let packet = InterchainPacket {
            sequence: envelope.sequence,
            source_chain: envelope.source_chain_id.clone(),
            source_channel: envelope.destination_channel.clone(),
            destination_chain: envelope.destination_chain_id.clone(),
            destination_channel: envelope.destination_channel.clone(),
            packet_type: envelope.message_type,
            payload: payload.to_vec(),
            timeout_height: envelope.expiry_height,
            timeout_timestamp: envelope.expiry_timestamp,
            sender: envelope.source_tx_hash.clone(),
            receiver: envelope.proof_reference.clone(),
            protocol_version: envelope.protocol_version.clone(),
        };
        Ok(VerifiedInteropMessage {
            envelope_digest: hex_hash(&envelope.digest()),
            replay_key,
            packet,
            phase: ValidationPhase::Verification,
        })
    }

    pub fn execute_verified(
        &mut self,
        verified: VerifiedInteropMessage,
        client_key: &str,
        proof: &crate::encoding::MembershipProof,
        height: u64,
        relayer: &IsolatedRelayer,
    ) -> Result<Vec<u8>, InteropError> {
        if verified.phase != ValidationPhase::Verification {
            return Err(InteropError::ObservationUnverified);
        }
        if self.consumed.contains(&verified.replay_key) {
            return Err(InteropError::PacketReplay);
        }
        let ack = self.engine.recv_packet(client_key, verified.packet, proof, height, relayer)?;
        self.consumed.insert(verified.replay_key);
        Ok(ack)
    }
}
