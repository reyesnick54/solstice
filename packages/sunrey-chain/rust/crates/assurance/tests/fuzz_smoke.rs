use sunrey_assurance::{
    consensus_vote_properties, decode_protocol_bytes, economic_campaign, interop_supply_ok,
    signer_safety_sequence, ASSURANCE_SEED,
};
use sunrey_native_assets::NativeAssetPayload;
use sunrey_wallet::parse_address;

#[test]
fn fuzz_smoke_corpus_and_decoders() {
    decode_protocol_bytes(&[]);
    decode_protocol_bytes(&[0xff; 64]);
    decode_protocol_bytes(b"EnvelopeV1");
    let _ = NativeAssetPayload::decode(&[0u8; 8]);
    let _ = parse_address("not-an-address", Some("net_sunrey_simulation"));
    consensus_vote_properties().unwrap();
    signer_safety_sequence(16).unwrap();
    interop_supply_ok().unwrap();
    economic_campaign(ASSURANCE_SEED, 32).unwrap();
}
