#![no_main]

use sunrey_consensus::{Proposal, ProposedValue};

fn fuzz(data: &[u8]) {
    let _ = Proposal::decode(data);
    let _ = ProposedValue::decode(data);
}

#[cfg(not(fuzzing))]
fn main() {}

#[cfg(fuzzing)]
libfuzzer_sys::fuzz_target!(|data: &[u8]| {
    fuzz(data);
});
