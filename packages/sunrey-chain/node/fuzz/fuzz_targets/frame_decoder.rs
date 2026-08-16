#![no_main]

use sunrey_chain_node::codec::{decode_frame, FrameDecoder};

fn fuzz(data: &[u8]) {
    let _ = decode_frame(data);
    let mut decoder = FrameDecoder::new(1024);
    let _ = decoder.push(data);
}

#[cfg(not(fuzzing))]
fn main() {}

#[cfg(fuzzing)]
libfuzzer_sys::fuzz_target!(|data: &[u8]| {
    fuzz(data);
});
