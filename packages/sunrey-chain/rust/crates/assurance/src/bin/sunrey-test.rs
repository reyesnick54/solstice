use std::env;
use std::fs;
use std::path::PathBuf;
use std::process;

use sunrey_assurance::{
    consensus_vote_properties, decode_protocol_bytes, development_fee, economic_campaign,
    interop_supply_ok, rust_fingerprint, rust_formula, rust_median, rust_mul_div,
    signer_safety_sequence, wallet_auth_threshold, ASSURANCE_SEED,
};
use sunrey_protocol::{hex_decode, BlockHeader, GenesisV1, SignedTransaction, UnsignedTransaction};

fn usage() -> ! {
    eprintln!("sunrey-test replay <fixture>");
    eprintln!("sunrey-test fuzz-smoke");
    process::exit(2);
}

fn replay(path: PathBuf) {
    let raw = fs::read_to_string(&path).expect("read fixture");
    let value: serde_json::Value = serde_json::from_str(&raw).expect("json fixture");
    if let Some(hex) = value.pointer("/actions/0/payload/hex").and_then(|v| v.as_str()) {
        if let Ok(bytes) = hex_decode(hex) {
            decode_protocol_bytes(&bytes);
            let _ = UnsignedTransaction::decode(&bytes);
            let _ = SignedTransaction::decode(&bytes);
            let _ = BlockHeader::decode(&bytes);
            let _ = GenesisV1::decode(&bytes);
        }
    }
    if let Some(cases) = value.get("differential").and_then(|v| v.as_array()) {
        for case in cases {
            apply_differential(case);
        }
    }
    println!("replay {}: ok", path.display());
}

fn apply_differential(case: &serde_json::Value) {
    let kind = case.get("kind").and_then(|v| v.as_str()).unwrap_or("");
    let input = case.get("input").cloned().unwrap_or(serde_json::json!({}));
    let expected = case.get("expected").cloned().unwrap_or(serde_json::json!({}));
    match kind {
        "fee" => {
            let fee = development_fee(
                input["encodedBytes"].as_u64().unwrap_or(0) as u128,
                input["signatureCount"].as_u64().unwrap_or(0) as u128,
            )
            .expect("fee");
            assert_eq!(fee.to_string(), expected["fee"].as_str().unwrap_or(""));
        }
        "muldiv" => {
            let value = rust_mul_div(
                input["value"].as_u64().unwrap_or(0) as u128,
                input["numerator"].as_u64().unwrap_or(0) as u128,
                input["denominator"].as_u64().unwrap_or(1) as u128,
                input["rounding"].as_str().unwrap_or("FLOOR"),
            );
            assert_eq!(value.to_string(), expected["value"].as_str().unwrap_or(""));
        }
        "formula" => {
            let (uncapped, moonrey) = rust_formula(
                input["eligible"].as_u64().unwrap_or(0) as u128,
                input["categoryWeight"].as_u64().unwrap_or(0) as u128,
                input["claimWeight"].as_u64().unwrap_or(0) as u128,
                input["quality"].as_u64().unwrap_or(0) as u128,
                input["rounding"].as_str().unwrap_or("FLOOR"),
                input["maximum"].as_u64().unwrap_or(0) as u128,
            );
            assert_eq!(uncapped, expected["uncapped"].as_str().unwrap_or(""));
            assert_eq!(moonrey, expected["moonrey"].as_str().unwrap_or(""));
        }
        "fingerprint" => {
            let facts: Vec<&str> = input["facts"].as_str().unwrap_or("").split(',').collect();
            let upstream: Vec<&str> = input["upstream"]
                .as_str()
                .unwrap_or("")
                .split(',')
                .filter(|part| !part.is_empty())
                .collect();
            let hash = rust_fingerprint(
                input["objectId"].as_str().unwrap_or(""),
                input["epoch"].as_u64().unwrap_or(0),
                input["validFrom"].as_u64().unwrap_or(0),
                input["validUntil"].as_u64().unwrap_or(0),
                input["claimType"].as_str().unwrap_or("OUTPUT"),
                input["category"].as_str().unwrap_or("ENERGY"),
                input["normalized"].as_u64().unwrap_or(0) as u128,
                input["baseUnit"].as_str().unwrap_or("kWh"),
                &facts,
                &upstream,
            );
            assert_eq!(hash, expected["hash"].as_str().unwrap_or(""));
        }
        "median" => {
            let values: Vec<u64> = input["values"]
                .as_str()
                .unwrap_or("")
                .split(',')
                .filter_map(|part| part.parse().ok())
                .collect();
            assert_eq!(rust_median(&values).to_string(), expected["median"].as_str().unwrap_or(""));
        }
        _ => {}
    }
}

fn fuzz_smoke() {
    decode_protocol_bytes(&[0u8; 8]);
    decode_protocol_bytes(&[]);
    consensus_vote_properties().expect("consensus");
    signer_safety_sequence(32).expect("signer");
    wallet_auth_threshold(2, 1, false).expect("wallet insufficient");
    wallet_auth_threshold(2, 2, false).expect("wallet ok");
    wallet_auth_threshold(2, 2, true).expect("wallet duplicate");
    interop_supply_ok().expect("interop");
    let root = economic_campaign(ASSURANCE_SEED, 64).expect("economic");
    println!("fuzz-smoke root={root}");
}

fn main() {
    let mut args = env::args().skip(1);
    match args.next().as_deref() {
        Some("replay") => {
            let path = args.next().map(PathBuf::from).unwrap_or_else(|| usage());
            replay(path);
        }
        Some("fuzz-smoke") => fuzz_smoke(),
        _ => usage(),
    }
}
