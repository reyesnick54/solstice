//! SunRey sovereign development interoperability gateway.
//!
//! SunRey remains the authoritative base layer for SunRey economic state.
//! External chains may interoperate. They are not SunRey's source of truth.
//! Relayers are untrusted. There is no trusted-multisig bridge.

pub mod activation;
pub mod asset;
pub mod boundary;
pub mod channel;
pub mod circuit_breaker;
pub mod client;
pub mod connection;
pub mod crypto;
pub mod encoding;
pub mod engine;
pub mod envelope;
pub mod error;
pub mod evidence;
pub mod external_rpc;
pub mod flow;
pub mod foreign;
pub mod governance;
pub mod header;
pub mod identity;
pub mod ids;
pub mod keys;
pub mod light_client;
pub mod network;
pub mod oracle;
pub mod packet;
pub mod registry;
pub mod relayer;
pub mod rpc_access;
pub mod security;
pub mod types;
pub mod watcher;

pub mod cli;

pub use activation::{InteropActivationGate, InteropActivationState};
pub use asset::{InteropAssetLedger, DEV_INTEROP_TEST_ASSET};
pub use boundary::{InteropBoundary, ValidationPhase, VerifiedInteropMessage};
pub use circuit_breaker::{InteropCircuitBreakers, PauseAuthorityRegistry};
pub use engine::{
    amount_payload, development_fixture, make_packet, open_dev_path, InteropEngine, InteropMetrics,
};
pub use envelope::{InteropFlowDirection, InteropMessageEnvelope, ENVELOPE_SCHEMA_VERSION};
pub use error::InteropError;
pub use external_rpc::{ExternalRpcEvaluator, ExternalRpcObservation, FinalityRequirement};
pub use flow::{InteropFlowLedger, OutboundFlowState};
pub use foreign::ExternalDevChain;
pub use keys::{InteropKeyBinding, INTEROP_SIGNING_PURPOSE};
pub use network::{InteropNetworkPolicy, InteropServiceRole};
pub use relayer::IsolatedRelayer;
pub use rpc_access::{classify_rpc_method, interop_may_call, RpcMethodClass};
pub use types::*;
pub use watcher::{IsolatedWatcher, WatcherObservation, WatcherPort};

pub const INTEROP_PROTOCOL_VERSION: &str = "sunrey.interop.v1";
pub const DOMAIN_ID: &str = "sunrey.interop.id.v1";
pub const DOMAIN_HEADER: &str = "sunrey.interop.header.v1";
pub const DOMAIN_PACKET: &str = "sunrey.interop.packet.v1";
pub const DOMAIN_ACK: &str = "sunrey.interop.ack.v1";
pub const DOMAIN_LEAF: &str = "sunrey.interop.leaf.v1";
pub const DOMAIN_MERKLE: &str = "sunrey.interop.merkle.v1";
pub const DOMAIN_REGISTRY: &str = "sunrey.interop.registry.v1";
pub const DOMAIN_CRYPTO: &str = "sunrey.interop.crypto.v1";
pub const DOMAIN_EVIDENCE: &str = "sunrey.interop.evidence.v1";
pub const DOMAIN_STATE: &str = "sunrey.interop.state.v1";

pub const MAX_HEADER_BYTES: usize = 8_192;
pub const MAX_PROOF_BYTES: usize = 16_384;
pub const MAX_PACKET_BYTES: usize = 4_096;
pub const MAX_FUTURE_HEIGHT_DELTA: u64 = 1;
pub const MAX_PACKETS_PER_HEIGHT: u64 = 32;
