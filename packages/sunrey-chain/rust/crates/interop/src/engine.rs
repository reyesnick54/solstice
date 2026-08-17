use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use serde::{Deserialize, Serialize};
use sunrey_protocol::Hash32;

use crate::asset::{InteropAssetLedger, DEV_INTEROP_TEST_ASSET};
use crate::channel::InterchainChannel;
use crate::client::{ClientUpgrade, InterchainClientState, DEFAULT_TRUSTING_PERIOD};
use crate::connection::InterchainConnection;
use crate::crypto::SimulatedEd25519Verifier;
use crate::encoding::{domain_hash, hex_hash, require_size, MembershipProof};
use crate::error::InteropError;
use crate::evidence::{InterchainEvidenceRecord, MisbehaviorEvidence};
use crate::foreign::EXTERNAL_QUORUM;
use crate::governance::{GovernanceAuthorization, InteropGovernanceAction};
use crate::header::{FinalityProof, ForeignHeader};
use crate::identity::ExternalIdentityAttestation;
use crate::ids::{
    InterchainChannelId, InterchainClientId, InterchainConnectionId, InterchainPacketId,
};
use crate::light_client::LightClient;
use crate::oracle::VerifiedExternalChainFact;
use crate::packet::{acknowledgement_bytes, InterchainPacket, PacketRecord};
use crate::registry::{development_external_chain, ExternalChainDefinition, SUNREY_CHAIN_ID};
use crate::relayer::IsolatedRelayer;
use crate::security::InteropSecurityProfile;
use crate::types::{
    ActorKind, ChannelOrdering, ChannelType, ClientStatus, ConnectionState, InteropCapability,
    PacketLifecycle,
};
use crate::{
    INTEROP_PROTOCOL_VERSION, MAX_FUTURE_HEIGHT_DELTA, MAX_HEADER_BYTES, MAX_PACKETS_PER_HEIGHT,
    MAX_PACKET_BYTES, MAX_PROOF_BYTES,
};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct InteropMetrics {
    pub interop_clients: u64,
    pub interop_verified_headers: u64,
    pub interop_rejected_headers: u64,
    pub interop_packets_sent: u64,
    pub interop_packets_received: u64,
    pub interop_packet_replays: u64,
    pub interop_timeouts: u64,
    pub interop_client_age: u64,
    pub interop_client_frozen: u64,
    pub interop_proof_failures: u64,
    pub relayer_submissions: u64,
    pub duplicate_updates: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteropEngine {
    pub sunrey_chain_id: String,
    pub now_unix: u64,
    pub sunrey_height: u64,
    pub chains: BTreeMap<String, ExternalChainDefinition>,
    pub clients: BTreeMap<String, InterchainClientState>,
    pub connections: BTreeMap<String, InterchainConnection>,
    pub channels: BTreeMap<String, InterchainChannel>,
    pub packets: BTreeMap<String, PacketRecord>,
    pub replay: BTreeSet<String>,
    pub ack_replay: BTreeSet<String>,
    pub assets: InteropAssetLedger,
    pub oracle_facts: BTreeMap<String, VerifiedExternalChainFact>,
    pub identity: BTreeMap<String, ExternalIdentityAttestation>,
    pub evidence: Vec<InterchainEvidenceRecord>,
    pub packets_this_height: u64,
    pub metrics: InteropMetrics,
}

impl Default for InteropEngine {
    fn default() -> Self {
        Self {
            sunrey_chain_id: SUNREY_CHAIN_ID.to_string(),
            now_unix: 1_700_000_000,
            sunrey_height: 1,
            chains: BTreeMap::new(),
            clients: BTreeMap::new(),
            connections: BTreeMap::new(),
            channels: BTreeMap::new(),
            packets: BTreeMap::new(),
            replay: BTreeSet::new(),
            ack_replay: BTreeSet::new(),
            assets: InteropAssetLedger::development(1_000_000),
            oracle_facts: BTreeMap::new(),
            identity: BTreeMap::new(),
            evidence: Vec::new(),
            packets_this_height: 0,
            metrics: InteropMetrics::default(),
        }
    }
}

impl InteropEngine {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn verifier() -> SimulatedEd25519Verifier {
        SimulatedEd25519Verifier
    }

    pub fn load_or_init(dir: impl AsRef<Path>) -> Result<Self, InteropError> {
        let path = dir.as_ref().join("interop-v1.json");
        if path.exists() {
            let bytes = std::fs::read(path).map_err(|_| InteropError::SchemaInvalid)?;
            serde_json::from_slice(&bytes).map_err(|_| InteropError::SchemaInvalid)
        } else {
            Ok(Self::new())
        }
    }

    pub fn persist(&self, dir: impl AsRef<Path>) -> Result<(), InteropError> {
        let dir = dir.as_ref();
        std::fs::create_dir_all(dir).map_err(|_| InteropError::SchemaInvalid)?;
        let bytes = serde_json::to_vec_pretty(self).map_err(|_| InteropError::SchemaInvalid)?;
        std::fs::write(dir.join("interop-v1.json"), bytes).map_err(|_| InteropError::SchemaInvalid)
    }

    pub fn state_root(&self) -> Hash32 {
        let bytes = serde_json::to_vec(&self.canonical_view()).unwrap_or_default();
        domain_hash(crate::DOMAIN_STATE, &bytes)
    }

    pub fn canonical_view(&self) -> serde_json::Value {
        serde_json::json!({
            "chains": self.chains.keys().collect::<Vec<_>>(),
            "clients": self.clients.iter().map(|(k, c)| (k, c.latest_height, c.status.as_str())).collect::<Vec<_>>(),
            "connections": self.connections.iter().map(|(k, c)| (k, c.state.as_str())).collect::<Vec<_>>(),
            "channels": self.channels.iter().map(|(k, c)| (k, c.next_recv_sequence, c.next_send_sequence)).collect::<Vec<_>>(),
            "packets": self.packets.iter().map(|(k, p)| (k, p.lifecycle.as_str())).collect::<Vec<_>>(),
            "assets": self.assets.snapshot(),
            "oracle_facts": self.oracle_facts.keys().collect::<Vec<_>>(),
        })
    }

    pub fn register_chain(
        &mut self,
        def: ExternalChainDefinition,
        auth: &GovernanceAuthorization,
    ) -> Result<(), InteropError> {
        auth.require(InteropGovernanceAction::RegisterExternalChain)?;
        if def.external_chain_id == self.sunrey_chain_id {
            return Err(InteropError::WrongExternalChainId);
        }
        self.chains.insert(def.external_chain_id.clone(), def);
        Ok(())
    }

    pub fn activate_chain(
        &mut self,
        chain_id: &str,
        auth: &GovernanceAuthorization,
    ) -> Result<(), InteropError> {
        auth.require(InteropGovernanceAction::ActivateExternalChain)?;
        let chain = self.chains.get_mut(chain_id).ok_or(InteropError::UnregisteredChain)?;
        if matches!(
            chain.status,
            crate::types::ChainStatus::Revoked | crate::types::ChainStatus::Suspended
        ) {
            return Err(InteropError::StatusNotActivatable);
        }
        chain.status = crate::types::ChainStatus::ActiveDevelopment;
        chain.activation_height = self.sunrey_height;
        Ok(())
    }

    pub fn require_registered(
        &self,
        chain_id: &str,
    ) -> Result<&ExternalChainDefinition, InteropError> {
        let chain = self.chains.get(chain_id).ok_or(InteropError::UnregisteredChain)?;
        chain.require_usable()?;
        Ok(chain)
    }

    pub fn initialize_client(
        &mut self,
        client_id: InterchainClientId,
        chain_id: &str,
        genesis: &ForeignHeader,
        proof: &FinalityProof,
        validator_keys: Vec<(String, Vec<u8>)>,
    ) -> Result<(), InteropError> {
        let chain = self.require_registered(chain_id)?.clone();
        if genesis.chain_id != chain.external_chain_id {
            return Err(InteropError::WrongExternalChainId);
        }
        if hex_hash(&genesis.hash()) != chain.genesis_hash {
            return Err(InteropError::WrongGenesis);
        }
        let mut client = InterchainClientState {
            client_id: client_id.clone(),
            external_chain_id: chain_id.to_string(),
            client_type: chain.client_type,
            finality_model: chain.finality_model,
            status: ClientStatus::Uninitialized,
            genesis_hash: genesis.hash(),
            latest_height: 0,
            latest_state_root: genesis.state_root,
            validator_keys,
            quorum: EXTERNAL_QUORUM,
            trusting_period_seconds: DEFAULT_TRUSTING_PERIOD,
            last_update_unix: self.now_unix,
            client_version: genesis.client_version,
            headers: BTreeMap::new(),
            frozen_reason: None,
        };
        client.initialize_client(genesis, proof, &Self::verifier())?;
        self.clients.insert(client_id.canonical(), client);
        self.metrics.interop_clients = self.clients.len() as u64;
        self.metrics.interop_verified_headers += 1;
        Ok(())
    }

    pub fn submit_header_update(
        &mut self,
        client_key: &str,
        header: ForeignHeader,
        proof: FinalityProof,
        relayer: &IsolatedRelayer,
    ) -> Result<(), InteropError> {
        self.metrics.relayer_submissions += 1;
        require_size(&header.encode(), MAX_HEADER_BYTES)?;
        require_size(&proof.encode(), MAX_PROOF_BYTES)?;
        if header.height
            > self
                .clients
                .get(client_key)
                .map(|c| c.latest_height + MAX_FUTURE_HEIGHT_DELTA)
                .unwrap_or(0)
        {
            self.metrics.interop_rejected_headers += 1;
            return Err(InteropError::FutureHeightRejected);
        }
        let client = self.clients.get_mut(client_key).ok_or(InteropError::ClientNotFound)?;
        match client.verify_update(
            header,
            proof,
            &Self::verifier(),
            self.now_unix,
            self.sunrey_height,
        ) {
            Ok(_) => {
                self.metrics.interop_verified_headers += 1;
                Ok(())
            }
            Err(InteropError::DuplicateUpdate) => {
                self.metrics.duplicate_updates += 1;
                let _ = &relayer.relayer_id;
                Ok(())
            }
            Err(err) => {
                self.metrics.interop_rejected_headers += 1;
                if matches!(
                    err,
                    InteropError::InvalidHeader
                        | InteropError::InvalidFinalityProof
                        | InteropError::InvalidMembershipProof
                ) {
                    self.metrics.interop_proof_failures += 1;
                }
                Err(err)
            }
        }
    }

    pub fn freeze_on_misbehavior(
        &mut self,
        client_key: &str,
        evidence: MisbehaviorEvidence,
    ) -> Result<(), InteropError> {
        let client = self.clients.get_mut(client_key).ok_or(InteropError::ClientNotFound)?;
        let detected = client.detect_misbehavior(
            &evidence.header_a,
            &evidence.proof_a,
            &evidence.header_b,
            &evidence.proof_b,
            &Self::verifier(),
        );
        match detected {
            Err(InteropError::MisbehaviorDetected) => {
                client.status = ClientStatus::Frozen;
                client.frozen_reason = Some("conflicting_finality".into());
                self.metrics.interop_client_frozen += 1;
                self.evidence.push(InterchainEvidenceRecord {
                    kind: "LIGHT_CLIENT_MISBEHAVIOR".into(),
                    digest: hex_hash(&evidence.digest()),
                    detail: "conflicting headers at equal height".into(),
                });
                Ok(())
            }
            Ok(()) => Err(InteropError::SchemaInvalid),
            Err(err) => Err(err),
        }
    }

    pub fn expire_clients(&mut self) {
        for client in self.clients.values_mut() {
            client.maybe_expire(self.now_unix);
            if client.status == ClientStatus::Expired {
                self.metrics.interop_client_age = client.age_seconds(self.now_unix);
            }
        }
    }

    pub fn recover_expired_client(
        &mut self,
        client_key: &str,
        auth: &GovernanceAuthorization,
    ) -> Result<(), InteropError> {
        auth.require(InteropGovernanceAction::UpgradeClient)?;
        let client = self.clients.get_mut(client_key).ok_or(InteropError::ClientNotFound)?;
        if client.status != ClientStatus::Expired {
            return Err(InteropError::SchemaInvalid);
        }
        client.status = ClientStatus::Active;
        client.last_update_unix = self.now_unix;
        Ok(())
    }

    pub fn upgrade_client(
        &mut self,
        client_key: &str,
        upgrade: ClientUpgrade,
        auth: &GovernanceAuthorization,
    ) -> Result<(), InteropError> {
        auth.require(InteropGovernanceAction::UpgradeClient)?;
        if !upgrade.governance_authorized {
            return Err(InteropError::UpgradeUnauthorized);
        }
        let client = self.clients.get_mut(client_key).ok_or(InteropError::ClientNotFound)?;
        if upgrade.new_version == client.client_version
            && upgrade.new_client_type == client.client_type
        {
            return Err(InteropError::SilentUpgradeForbidden);
        }
        if upgrade.continuity_hash != client.latest_state_root {
            return Err(InteropError::TrustAnchorMismatch);
        }
        if upgrade.activation_height < self.sunrey_height {
            return Err(InteropError::UpgradeUnauthorized);
        }
        client.client_type = upgrade.new_client_type;
        client.client_version = upgrade.new_version;
        Ok(())
    }

    pub fn handshake_connection(
        &mut self,
        connection: InterchainConnection,
        step: ConnectionState,
        auth: Option<&GovernanceAuthorization>,
    ) -> Result<(), InteropError> {
        let key = connection.connection_id.canonical();
        if step == ConnectionState::Open || step == ConnectionState::Confirm {
            if let Some(auth) = auth {
                auth.require(InteropGovernanceAction::ActivateConnection)?;
            } else {
                return Err(InteropError::GovernanceRequired);
            }
        }
        if let Some(existing) = self.connections.get_mut(&key) {
            existing.step(step)?;
        } else {
            if step != ConnectionState::Init {
                return Err(InteropError::ConnectionHandshakeInvalid);
            }
            self.connections.insert(key, connection);
        }
        Ok(())
    }

    pub fn open_channel(
        &mut self,
        channel: InterchainChannel,
        auth: Option<&GovernanceAuthorization>,
    ) -> Result<(), InteropError> {
        let conn = self
            .connections
            .get(&channel.connection_id.canonical())
            .ok_or(InteropError::ConnectionNotFound)?;
        conn.require_open()?;
        let foreign_id = if channel.channel_id.source_chain == self.sunrey_chain_id {
            &channel.channel_id.destination_chain
        } else {
            &channel.channel_id.source_chain
        };
        let chain = self.require_registered(foreign_id)?;
        let cap = match channel.channel_type {
            ChannelType::GenericMessage => InteropCapability::GenericMessage,
            ChannelType::EconomicAttestation => InteropCapability::EconomicAttestation,
            ChannelType::AssetTransferReserved => InteropCapability::AssetTransferDevOnly,
            ChannelType::OracleFact => InteropCapability::OracleFact,
            ChannelType::IdentityAttestationReserved => InteropCapability::IdentityAttestation,
        };
        chain.allows(cap)?;
        if channel.channel_type.high_risk() {
            let auth = auth.ok_or(InteropError::GovernanceRequired)?;
            auth.require(InteropGovernanceAction::SetChannelCapabilities)?;
        }
        let mut channel = channel;
        channel.state = ConnectionState::Open;
        self.channels.insert(channel.channel_id.canonical(), channel);
        Ok(())
    }

    pub fn send_packet(
        &mut self,
        packet: InterchainPacket,
    ) -> Result<InterchainPacket, InteropError> {
        require_size(&packet.encode(), MAX_PACKET_BYTES)?;
        if self.packets_this_height >= MAX_PACKETS_PER_HEIGHT {
            return Err(InteropError::RateLimited);
        }
        let channel =
            self.channels.get_mut(&packet.source_channel).ok_or(InteropError::ChannelNotFound)?;
        channel.require_open()?;
        channel.require_type(packet.packet_type)?;
        channel.require_governed_if_high_risk()?;
        packet.bind_matches(
            &channel.channel_id.source_chain,
            &channel.channel_id.destination_chain,
            INTEROP_PROTOCOL_VERSION,
        )?;
        if channel.ordering == ChannelOrdering::Ordered
            && packet.sequence != channel.next_send_sequence
        {
            return Err(InteropError::SequenceMismatch);
        }
        channel.next_send_sequence = channel.next_send_sequence.saturating_add(1);
        let commitment = packet.payload_commitment();
        let key = packet.packet_id().canonical();
        self.packets.insert(
            key,
            PacketRecord {
                packet: packet.clone(),
                commitment,
                lifecycle: PacketLifecycle::Sent,
                acknowledgement: None,
            },
        );
        self.packets_this_height += 1;
        self.metrics.interop_packets_sent += 1;
        Ok(packet)
    }

    pub fn recv_packet(
        &mut self,
        client_key: &str,
        packet: InterchainPacket,
        proof: &MembershipProof,
        height: u64,
        relayer: &IsolatedRelayer,
    ) -> Result<Vec<u8>, InteropError> {
        self.metrics.relayer_submissions += 1;
        require_size(&proof.encode(), MAX_PROOF_BYTES)?;
        let client = self.clients.get(client_key).ok_or(InteropError::ClientNotFound)?;
        client.status.can_verify()?;
        let value = client.verify_membership(height, proof)?;
        if value != packet.encode() || proof.value != packet.encode() {
            self.metrics.interop_proof_failures += 1;
            return Err(InteropError::ModifiedPacket);
        }
        let replay = hex_hash(&packet.replay_key());
        if !self.replay.insert(replay) {
            self.metrics.interop_packet_replays += 1;
            return Err(InteropError::PacketReplay);
        }
        let dest_channel = self
            .channels
            .get_mut(&packet.destination_channel)
            .ok_or(InteropError::ChannelNotFound)?;
        dest_channel.require_open()?;
        dest_channel.require_type(packet.packet_type)?;
        if dest_channel.ordering == ChannelOrdering::Ordered {
            if packet.sequence != dest_channel.next_recv_sequence {
                return Err(InteropError::OrderedSequenceGap);
            }
            dest_channel.next_recv_sequence += 1;
        } else if packet.sequence < dest_channel.next_recv_sequence
            && dest_channel.ordering == ChannelOrdering::Unordered
        {
            // unordered still uses replay set above
        }
        if dest_channel.ordering == ChannelOrdering::Unordered {
            dest_channel.next_recv_sequence =
                dest_channel.next_recv_sequence.max(packet.sequence + 1);
        }
        if packet.timeout_height != 0 && height > packet.timeout_height {
            return Err(InteropError::Timeout);
        }
        if packet.timeout_timestamp != 0 && self.now_unix > packet.timeout_timestamp {
            return Err(InteropError::Timeout);
        }
        let ack = acknowledgement_bytes(&packet, "OK");
        let key = packet.packet_id().canonical();
        self.packets.insert(
            key,
            PacketRecord {
                packet: packet.clone(),
                commitment: packet.payload_commitment(),
                lifecycle: PacketLifecycle::Received,
                acknowledgement: Some(ack.clone()),
            },
        );
        self.apply_payload(&packet)?;
        self.metrics.interop_packets_received += 1;
        let _ = &relayer.relayer_id;
        Ok(ack)
    }

    pub fn acknowledge_packet(
        &mut self,
        packet_key: &str,
        ack: &[u8],
        client_key: &str,
        proof: &MembershipProof,
        height: u64,
    ) -> Result<(), InteropError> {
        let ack_hex = hex_hash(&domain_hash(crate::DOMAIN_ACK, ack));
        if !self.ack_replay.insert(ack_hex) {
            return Err(InteropError::AckReplay);
        }
        let client = self.clients.get(client_key).ok_or(InteropError::ClientNotFound)?;
        let value = client.verify_membership(height, proof)?;
        if value != ack && proof.value != ack {
            return Err(InteropError::InvalidMembershipProof);
        }
        let record = self.packets.get_mut(packet_key).ok_or(InteropError::PacketNotFound)?;
        if record.lifecycle == PacketLifecycle::Acknowledged {
            return Err(InteropError::AckReplay);
        }
        record.lifecycle = PacketLifecycle::Acknowledged;
        record.acknowledgement = Some(ack.to_vec());
        Ok(())
    }

    pub fn timeout_packet(
        &mut self,
        packet_key: &str,
        client_key: &str,
        height: u64,
        left: Option<&MembershipProof>,
        right: Option<&MembershipProof>,
        receipt_key: &str,
    ) -> Result<(), InteropError> {
        let record = self.packets.get(packet_key).ok_or(InteropError::PacketNotFound)?.clone();
        if record.lifecycle != PacketLifecycle::Sent {
            return Err(InteropError::Timeout);
        }
        let timed_out = (record.packet.timeout_height != 0
            && height >= record.packet.timeout_height)
            || (record.packet.timeout_timestamp != 0
                && self.now_unix >= record.packet.timeout_timestamp);
        if !timed_out {
            return Err(InteropError::TimeoutProofRequired);
        }
        let client = self.clients.get(client_key).ok_or(InteropError::ClientNotFound)?;
        client.verify_non_membership(height, receipt_key, left, right)?;
        if record.packet.packet_type == ChannelType::AssetTransferReserved {
            let amount = decode_amount(&record.packet.payload)?;
            self.assets.timeout_recover(amount)?;
        }
        if let Some(row) = self.packets.get_mut(packet_key) {
            row.lifecycle = PacketLifecycle::TimedOut;
        }
        self.metrics.interop_timeouts += 1;
        Ok(())
    }

    fn apply_payload(&mut self, packet: &InterchainPacket) -> Result<(), InteropError> {
        match packet.packet_type {
            ChannelType::GenericMessage => Ok(()),
            ChannelType::OracleFact => {
                let fact = VerifiedExternalChainFact::from_verified(
                    packet.source_chain.clone(),
                    String::from_utf8_lossy(&packet.payload).into_owned(),
                    packet.payload.clone(),
                    packet.sequence,
                    hex_hash(&packet.payload_commitment()),
                );
                self.oracle_facts.insert(fact.fact_id.clone(), fact);
                Ok(())
            }
            ChannelType::AssetTransferReserved => {
                InteropAssetLedger::refuse_fiat(DEV_INTEROP_TEST_ASSET)?;
                let amount = decode_amount(&packet.payload)?;
                self.assets.represent_remote(amount)
            }
            ChannelType::IdentityAttestationReserved => {
                let att = ExternalIdentityAttestation::draft(
                    packet.sender.clone(),
                    packet.payload.clone(),
                    packet.source_chain.clone(),
                );
                self.identity.insert(packet.sender.clone(), att);
                Ok(())
            }
            ChannelType::EconomicAttestation => Ok(()),
        }
    }

    pub fn escrow_dev_asset(&mut self, amount: u128) -> Result<(), InteropError> {
        InteropAssetLedger::refuse_fiat(DEV_INTEROP_TEST_ASSET)?;
        self.assets.escrow(amount)
    }

    pub fn security_profile(
        &self,
        client_key: &str,
    ) -> Result<InteropSecurityProfile, InteropError> {
        let client = self.clients.get(client_key).ok_or(InteropError::ClientNotFound)?;
        let chain =
            self.chains.get(&client.external_chain_id).ok_or(InteropError::UnregisteredChain)?;
        Ok(InteropSecurityProfile::derive(
            client,
            &chain.proof_system,
            crate::types::CryptoClassification::Classical,
            self.now_unix,
        ))
    }

    pub fn oracle_fact(&self, fact_id: &str) -> Result<&VerifiedExternalChainFact, InteropError> {
        self.oracle_facts.get(fact_id).ok_or(InteropError::PacketNotFound)
    }

    pub fn refuse_oracle_as_economic_truth(&self, fact_id: &str) -> Result<(), InteropError> {
        self.oracle_fact(fact_id)?.refuse_as_economic_truth()
    }

    pub fn metrics_json(&self) -> serde_json::Value {
        serde_json::to_value(&self.metrics).unwrap_or_default()
    }
}

fn decode_amount(payload: &[u8]) -> Result<u128, InteropError> {
    if let Ok(text) = std::str::from_utf8(payload) {
        if let Some(rest) = text.strip_prefix("DEV_INTEROP_TEST_ASSET:") {
            return rest.parse().map_err(|_| InteropError::SchemaInvalid);
        }
        if let Ok(value) = text.parse::<u128>() {
            return Ok(value);
        }
    }
    if payload.len() == 16 {
        let mut buf = [0u8; 16];
        buf.copy_from_slice(payload);
        return Ok(u128::from_be_bytes(buf));
    }
    Err(InteropError::SchemaInvalid)
}

pub fn amount_payload(amount: u128) -> Vec<u8> {
    format!("{DEV_INTEROP_TEST_ASSET}:{amount}").into_bytes()
}

pub fn gov(
    actor: &str,
    kind: ActorKind,
    action: InteropGovernanceAction,
    target: &str,
) -> GovernanceAuthorization {
    GovernanceAuthorization {
        actor_id: actor.to_string(),
        actor_kind: kind,
        action,
        target: target.to_string(),
    }
}

pub fn development_fixture(
    genesis: &ForeignHeader,
    genesis_proof: &FinalityProof,
    validator_keys: Vec<(String, Vec<u8>)>,
) -> Result<InteropEngine, InteropError> {
    let mut engine = InteropEngine::new();
    let mut def = development_external_chain(hex_hash(&genesis.hash()), hex_hash(&genesis.hash()));
    let register = gov(
        "gov_operator_1",
        ActorKind::GovernanceSigner,
        InteropGovernanceAction::RegisterExternalChain,
        &def.external_chain_id,
    );
    engine.register_chain(def.clone(), &register)?;
    def.status = crate::types::ChainStatus::ActiveDevelopment;
    let activate = gov(
        "gov_operator_1",
        ActorKind::GovernanceSigner,
        InteropGovernanceAction::ActivateExternalChain,
        &def.external_chain_id,
    );
    engine.activate_chain(&def.external_chain_id, &activate)?;
    let client_id = InterchainClientId::new(&def.external_chain_id, SUNREY_CHAIN_ID, "client-0");
    engine.initialize_client(
        client_id,
        &def.external_chain_id,
        genesis,
        genesis_proof,
        validator_keys,
    )?;
    Ok(engine)
}

pub fn open_dev_path(
    engine: &mut InteropEngine,
    source: &str,
    dest: &str,
    channel_type: ChannelType,
    ordering: ChannelOrdering,
) -> Result<(String, String, String), InteropError> {
    let src_client = InterchainClientId::new(source, dest, "client-0");
    let dst_client = InterchainClientId::new(dest, source, "client-0");
    let conn_id = InterchainConnectionId::new(source, dest, "conn-0");
    let connection = InterchainConnection {
        connection_id: conn_id.clone(),
        source_client: src_client.clone(),
        destination_client: dst_client,
        protocol_version: INTEROP_PROTOCOL_VERSION.to_string(),
        capabilities: vec![
            InteropCapability::GenericMessage,
            InteropCapability::OracleFact,
            InteropCapability::AssetTransferDevOnly,
            InteropCapability::IdentityAttestation,
            InteropCapability::EconomicAttestation,
        ],
        proof_requirement: "LIGHT_CLIENT_MEMBERSHIP".into(),
        state: ConnectionState::Init,
    };
    engine.handshake_connection(connection.clone(), ConnectionState::Init, None)?;
    engine.handshake_connection(connection.clone(), ConnectionState::Try, None)?;
    engine.handshake_connection(connection.clone(), ConnectionState::Ack, None)?;
    let auth = gov(
        "gov_operator_1",
        ActorKind::GovernanceSigner,
        InteropGovernanceAction::ActivateConnection,
        &conn_id.canonical(),
    );
    engine.handshake_connection(connection, ConnectionState::Confirm, Some(&auth))?;
    let chan_id = InterchainChannelId::new(source, dest, conn_id.canonical(), "chan-0");
    let dest_chan = InterchainChannelId::new(dest, source, conn_id.canonical(), "chan-0");
    let channel_auth = if channel_type.high_risk() {
        Some(gov(
            "gov_operator_1",
            ActorKind::GovernanceSigner,
            InteropGovernanceAction::SetChannelCapabilities,
            &chan_id.canonical(),
        ))
    } else {
        None
    };
    engine.open_channel(
        InterchainChannel {
            channel_id: chan_id.clone(),
            connection_id: conn_id.clone(),
            channel_type,
            ordering,
            state: ConnectionState::Init,
            next_send_sequence: 0,
            next_recv_sequence: 0,
            governed: channel_type.high_risk(),
        },
        channel_auth.as_ref(),
    )?;
    engine.open_channel(
        InterchainChannel {
            channel_id: dest_chan.clone(),
            connection_id: conn_id.clone(),
            channel_type,
            ordering,
            state: ConnectionState::Init,
            next_send_sequence: 0,
            next_recv_sequence: 0,
            governed: channel_type.high_risk(),
        },
        channel_auth.as_ref(),
    )?;
    Ok((src_client.canonical(), chan_id.canonical(), dest_chan.canonical()))
}

#[allow(clippy::too_many_arguments)]
pub fn make_packet(
    source: &str,
    dest: &str,
    source_channel: &str,
    dest_channel: &str,
    sequence: u64,
    packet_type: ChannelType,
    payload: Vec<u8>,
    timeout_height: u64,
) -> InterchainPacket {
    InterchainPacket {
        sequence,
        source_chain: source.to_string(),
        source_channel: source_channel.to_string(),
        destination_chain: dest.to_string(),
        destination_channel: dest_channel.to_string(),
        packet_type,
        payload,
        timeout_height,
        timeout_timestamp: 0,
        sender: "ext.sender".into(),
        receiver: "sunrey.receiver".into(),
        protocol_version: INTEROP_PROTOCOL_VERSION.to_string(),
    }
}

pub fn packet_state_key(packet: &InterchainPacket) -> String {
    format!("packets/{}", packet.packet_id().canonical())
}

pub fn ack_state_key(packet: &InterchainPacket) -> String {
    format!("acks/{}", packet.packet_id().canonical())
}

pub fn receipt_state_key(id: &InterchainPacketId) -> String {
    format!("receipts/{}", id.canonical())
}
