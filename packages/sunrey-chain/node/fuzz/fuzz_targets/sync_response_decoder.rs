#![no_main]

use sunrey_chain_node::messages::decode_sync_response;

fn fuzz(data: &[u8]) {
    let _ = decode_sync_response(data);
}

#[cfg(not(fuzzing))]
fn main() {}

#[cfg(fuzzing)]
libfuzzer_sys::fuzz_target!(|data: &[u8]| {
    fuzz(data);
});
