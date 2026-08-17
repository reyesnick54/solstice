#![no_main]

use sunrey_protocol::GenesisV1;

fn fuzz(data: &[u8]) {
    let _ = GenesisV1::decode(data);
}

#[cfg(not(fuzzing))]
fn main() {}

#[cfg(fuzzing)]
libfuzzer_sys::fuzz_target!(|data: &[u8]| {
    fuzz(data);
});
