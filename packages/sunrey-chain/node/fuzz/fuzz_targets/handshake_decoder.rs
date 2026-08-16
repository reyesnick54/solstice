#![no_main]

use sunrey_chain_node::handshake::HandshakeHello;

fn fuzz(data: &[u8]) {
    let _ = HandshakeHello::decode(data);
}

#[cfg(not(fuzzing))]
fn main() {}

#[cfg(fuzzing)]
libfuzzer_sys::fuzz_target!(|data: &[u8]| {
    fuzz(data);
});
