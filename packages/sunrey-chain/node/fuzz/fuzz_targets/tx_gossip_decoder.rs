#![no_main]

use sunrey_chain_node::messages::decode_tx_gossip;

fn fuzz(data: &[u8]) {
    let _ = decode_tx_gossip(data);
}

#[cfg(not(fuzzing))]
fn main() {}

#[cfg(fuzzing)]
libfuzzer_sys::fuzz_target!(|data: &[u8]| {
    fuzz(data);
});
