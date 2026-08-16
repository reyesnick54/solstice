#![no_main]

use sunrey_consensus::Vote;

fn fuzz(data: &[u8]) {
    let _ = Vote::decode(data);
}

#[cfg(not(fuzzing))]
fn main() {}

#[cfg(fuzzing)]
libfuzzer_sys::fuzz_target!(|data: &[u8]| {
    fuzz(data);
});
