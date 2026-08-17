#![no_main]

use sunrey_protocol::{SignedTransaction, UnsignedTransaction, decode_evidence_anchor_payload, decode_system_payload};

fn fuzz(data: &[u8]) {
    let _ = UnsignedTransaction::decode(data);
    let _ = SignedTransaction::decode(data);
    let _ = decode_system_payload(data);
    let _ = decode_evidence_anchor_payload(data);
}

#[cfg(not(fuzzing))]
fn main() {}

#[cfg(fuzzing)]
libfuzzer_sys::fuzz_target!(|data: &[u8]| {
    fuzz(data);
});
