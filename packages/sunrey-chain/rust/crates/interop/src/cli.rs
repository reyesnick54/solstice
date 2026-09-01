use std::path::PathBuf;

use crate::encoding::hex_hash;
use crate::engine::InteropEngine;
use crate::error::InteropError;
use crate::foreign::ExternalDevChain;
use crate::registry::EXTERNAL_DEV_CHAIN_ID;
use crate::relayer::IsolatedRelayer;
use crate::watcher::{self, IsolatedWatcher};

pub fn run_interop_command(args: &[String]) -> Result<String, InteropError> {
    if args.is_empty() {
        return Ok(
            "usage: sunrey-node interop chains|client|header|connection|channel|packets|proof|security"
                .into(),
        );
    }
    let data_dir = data_dir_from(args);
    let engine = InteropEngine::load_or_init(&data_dir)?;
    match args[0].as_str() {
        "chains" => Ok(serde_json::to_string_pretty(&engine.chains).unwrap_or_default()),
        "client" => Ok(serde_json::to_string_pretty(&engine.clients).unwrap_or_default()),
        "header" => {
            let headers: Vec<_> =
                engine.clients.values().flat_map(|c| c.headers.values()).collect();
            Ok(serde_json::to_string_pretty(&headers).unwrap_or_default())
        }
        "connection" => Ok(serde_json::to_string_pretty(&engine.connections).unwrap_or_default()),
        "channel" => Ok(serde_json::to_string_pretty(&engine.channels).unwrap_or_default()),
        "packets" => Ok(serde_json::to_string_pretty(&engine.packets).unwrap_or_default()),
        "proof" => Ok(serde_json::json!({
            "proof_system": "SORTED_MERKLE_V1",
            "verified_headers": engine.metrics.interop_verified_headers,
            "proof_failures": engine.metrics.interop_proof_failures,
        })
        .to_string()),
        "security" => {
            if let Some(key) = engine.clients.keys().next() {
                let profile = engine.security_profile(key)?;
                Ok(serde_json::to_string_pretty(&profile).unwrap_or_default())
            } else {
                Ok(serde_json::json!({
                    "status": "NO_CLIENT",
                    "absolute_security_claim": false,
                    "trusted_multisig_bridge": false,
                    "production_ready": false,
                })
                .to_string())
            }
        }
        "demo" => run_demo(&data_dir),
        _ => Err(InteropError::SchemaInvalid),
    }
}

pub fn run_relayer_command(args: &[String]) -> Result<String, InteropError> {
    if args.first().map(String::as_str) != Some("run")
        && args.first().map(String::as_str) != Some("demo")
    {
        return Ok("usage: sunrey-relayer run".into());
    }
    let data_dir = data_dir_from(args);
    run_demo(&data_dir)
}

pub fn run_watcher_command(args: &[String]) -> Result<String, InteropError> {
    if args.first().map(String::as_str) != Some("run")
        && args.first().map(String::as_str) != Some("observe")
    {
        return Ok("usage: sunrey-watcher run|observe".into());
    }
    let watcher = IsolatedWatcher::new("watcher-dev-1", EXTERNAL_DEV_CHAIN_ID);
    watcher.cannot_submit()?;
    Ok(serde_json::json!({
        "service": "sunrey-watcher",
        "watcher_id": watcher.watcher_id,
        "source_chain_id": watcher.source_chain_id,
        "security_model": watcher::watcher_security_model(1),
        "note": "isolated observation only; production interop is not enabled",
    })
    .to_string())
}

fn data_dir_from(args: &[String]) -> PathBuf {
    args.windows(2).find(|w| w[0] == "--data-dir").map(|w| PathBuf::from(&w[1])).unwrap_or_else(
        || {
            std::env::var("SUNREY_DATA_DIR")
                .map(PathBuf::from)
                .unwrap_or_else(|_| std::env::temp_dir().join("sunrey-interop-dev"))
        },
    )
}

fn run_demo(data_dir: &std::path::Path) -> Result<String, InteropError> {
    let mut foreign = ExternalDevChain::genesis();
    let mut engine = crate::engine::development_fixture(
        foreign.latest_header()?,
        foreign.latest_proof()?,
        foreign.validator_public_keys(),
    )?;
    let relayer_a = IsolatedRelayer::new("relayer-a");
    let relayer_b = IsolatedRelayer::new("relayer-b");
    foreign.put("demo/note", b"hello-sunrey".to_vec());
    let (header, proof) = foreign.finalize_next()?;
    let client_key = engine.clients.keys().next().cloned().ok_or(InteropError::ClientNotFound)?;
    engine.submit_header_update(&client_key, header.clone(), proof.clone(), &relayer_a)?;
    engine.submit_header_update(&client_key, header, proof, &relayer_b)?;
    engine.persist(data_dir)?;
    Ok(serde_json::json!({
        "environment": "simulation",
        "external_chain": EXTERNAL_DEV_CHAIN_ID,
        "verified_height": engine.clients[&client_key].latest_height,
        "state_root": hex_hash(&engine.state_root()),
        "duplicate_relayer_safe": true,
        "metrics": engine.metrics,
        "note": "development interoperability demo; production interop is not enabled",
    })
    .to_string())
}
