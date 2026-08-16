#![no_main]

use sunrey_consensus::CommitCertificate;

fn fuzz(data: &[u8]) {
    let _ = CommitCertificate::decode(data);
}

#[cfg(not(fuzzing))]
fn main() {}

#[cfg(fuzzing)]
libfuzzer_sys::fuzz_target!(|data: &[u8]| {
    fuzz(data);
});
