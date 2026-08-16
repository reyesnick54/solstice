//! Quinn / QUIC transport with rustls TLS 1.3.
//!
//! Encryption is provided by rustls. This module does not implement
//! transport encryption. Peer authentication is the signed application
//! handshake (Ed25519 node identity), not WebPKI.

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use quinn::{ClientConfig, Endpoint, ServerConfig, TransportConfig};
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::pki_types::{CertificateDer, PrivatePkcs8KeyDer, ServerName, UnixTime};
use rustls::{DigitallySignedStruct, Error as TlsError, SignatureScheme};

use crate::error::{NodeError, NodeResult};

pub const ALPN: &[u8] = b"sunrey-p2p/1";

#[derive(Debug)]
struct SkipServerVerification;

impl ServerCertVerifier for SkipServerVerification {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, TlsError> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, TlsError> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, TlsError> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        rustls::crypto::ring::default_provider()
            .signature_verification_algorithms
            .supported_schemes()
    }
}

fn install_crypto_provider() {
    let _ = rustls::crypto::ring::default_provider().install_default();
}

fn self_signed_cert() -> NodeResult<(CertificateDer<'static>, PrivatePkcs8KeyDer<'static>)> {
    let cert = rcgen::generate_simple_self_signed(vec!["sunrey-dev-node".into()])
        .map_err(|e| NodeError::Transport(e.to_string()))?;
    let cert_der = CertificateDer::from(cert.cert);
    let key = PrivatePkcs8KeyDer::from(cert.key_pair.serialize_der());
    Ok((cert_der, key))
}

pub fn bind_endpoint(listen: SocketAddr) -> NodeResult<Endpoint> {
    install_crypto_provider();
    let (cert, key) = self_signed_cert()?;
    let mut server_crypto = rustls::ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(vec![cert], key.into())
        .map_err(|e| NodeError::Transport(e.to_string()))?;
    server_crypto.alpn_protocols = vec![ALPN.to_vec()];

    let mut transport = TransportConfig::default();
    transport.max_concurrent_bidi_streams(8u32.into());
    transport.max_idle_timeout(Some(Duration::from_secs(20).try_into().unwrap()));
    transport.keep_alive_interval(Some(Duration::from_secs(2)));

    let mut server = ServerConfig::with_crypto(Arc::new(
        quinn::crypto::rustls::QuicServerConfig::try_from(server_crypto)
            .map_err(|e| NodeError::Transport(e.to_string()))?,
    ));
    server.transport_config(Arc::new(transport));

    let mut endpoint =
        Endpoint::server(server, listen).map_err(|e| NodeError::Transport(e.to_string()))?;
    endpoint.set_default_client_config(client_config()?);
    Ok(endpoint)
}

fn client_config() -> NodeResult<ClientConfig> {
    install_crypto_provider();
    let mut client_crypto = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(SkipServerVerification))
        .with_no_client_auth();
    client_crypto.alpn_protocols = vec![ALPN.to_vec()];
    Ok(ClientConfig::new(Arc::new(
        quinn::crypto::rustls::QuicClientConfig::try_from(client_crypto)
            .map_err(|e| NodeError::Transport(e.to_string()))?,
    )))
}
