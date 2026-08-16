//! Length-prefixed binary codec (CodecV1).
//!
//! Consensus/network bytes are this encoding, not JSON. JSON is a debug
//! projection only (ADR-0021). Decoders never panic on peer input.

use crate::error::{NodeError, NodeResult};

pub const FRAME_MAGIC: [u8; 4] = *b"SRP1";
pub const MAX_FRAME_BYTES: u32 = 1_048_576;
pub const MAX_STRING_BYTES: usize = 4096;

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Channel {
    Consensus = 0,
    BlockGossip = 1,
    TransactionGossip = 2,
    StateSync = 3,
    PeerControl = 4,
}

impl Channel {
    pub fn from_u8(value: u8) -> NodeResult<Self> {
        match value {
            0 => Ok(Self::Consensus),
            1 => Ok(Self::BlockGossip),
            2 => Ok(Self::TransactionGossip),
            3 => Ok(Self::StateSync),
            4 => Ok(Self::PeerControl),
            _ => Err(NodeError::Codec(format!("unknown channel {value}"))),
        }
    }

    pub fn priority(self) -> u8 {
        match self {
            Self::Consensus => 0,
            Self::PeerControl => 1,
            Self::StateSync => 2,
            Self::BlockGossip => 3,
            Self::TransactionGossip => 4,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Frame {
    pub channel: Channel,
    pub flags: u16,
    pub payload: Vec<u8>,
}

pub fn encode_frame(frame: &Frame) -> NodeResult<Vec<u8>> {
    if frame.payload.len() > MAX_FRAME_BYTES as usize {
        return Err(NodeError::Codec("oversized frame".into()));
    }
    let mut out = Vec::with_capacity(11 + frame.payload.len());
    out.extend_from_slice(&FRAME_MAGIC);
    out.push(frame.channel as u8);
    out.extend_from_slice(&frame.flags.to_be_bytes());
    out.extend_from_slice(&(frame.payload.len() as u32).to_be_bytes());
    out.extend_from_slice(&frame.payload);
    Ok(out)
}

pub fn decode_frame(bytes: &[u8]) -> NodeResult<Frame> {
    if bytes.len() < 11 {
        return Err(NodeError::Codec("truncated frame header".into()));
    }
    if bytes[0..4] != FRAME_MAGIC {
        return Err(NodeError::Codec("invalid magic / codec".into()));
    }
    let channel = Channel::from_u8(bytes[4])?;
    let flags = u16::from_be_bytes([bytes[5], bytes[6]]);
    let len = u32::from_be_bytes([bytes[7], bytes[8], bytes[9], bytes[10]]);
    if len > MAX_FRAME_BYTES {
        return Err(NodeError::Codec("oversized frame".into()));
    }
    let expected = 11 + len as usize;
    if bytes.len() != expected {
        return Err(NodeError::Codec("frame length mismatch".into()));
    }
    Ok(Frame {
        channel,
        flags,
        payload: bytes[11..].to_vec(),
    })
}

/// Incremental reader that never trusts a peer-supplied length blindly.
pub struct FrameDecoder {
    buf: Vec<u8>,
    max_frame: u32,
}

impl FrameDecoder {
    pub fn new(max_frame: u32) -> Self {
        Self {
            buf: Vec::new(),
            max_frame: max_frame.min(MAX_FRAME_BYTES),
        }
    }

    pub fn push(&mut self, data: &[u8]) -> NodeResult<Vec<Frame>> {
        if self.buf.len().saturating_add(data.len()) > (self.max_frame as usize).saturating_mul(2) {
            return Err(NodeError::Codec("decoder buffer exhausted".into()));
        }
        self.buf.extend_from_slice(data);
        let mut frames = Vec::new();
        loop {
            if self.buf.len() < 11 {
                break;
            }
            if self.buf[0..4] != FRAME_MAGIC {
                self.buf.clear();
                return Err(NodeError::Codec("invalid magic / codec".into()));
            }
            let len = u32::from_be_bytes([self.buf[7], self.buf[8], self.buf[9], self.buf[10]]);
            if len > self.max_frame {
                self.buf.clear();
                return Err(NodeError::Codec("oversized frame".into()));
            }
            let total = 11 + len as usize;
            if self.buf.len() < total {
                break;
            }
            let raw: Vec<u8> = self.buf.drain(..total).collect();
            frames.push(decode_frame(&raw)?);
        }
        Ok(frames)
    }
}

pub struct Writer {
    buf: Vec<u8>,
}

impl Default for Writer {
    fn default() -> Self {
        Self::new()
    }
}

impl Writer {
    pub fn new() -> Self {
        Self { buf: Vec::new() }
    }

    pub fn u8(&mut self, value: u8) {
        self.buf.push(value);
    }

    pub fn u16(&mut self, value: u16) {
        self.buf.extend_from_slice(&value.to_be_bytes());
    }

    pub fn u32(&mut self, value: u32) {
        self.buf.extend_from_slice(&value.to_be_bytes());
    }

    pub fn u64(&mut self, value: u64) {
        self.buf.extend_from_slice(&value.to_be_bytes());
    }

    pub fn bytes(&mut self, value: &[u8]) -> NodeResult<()> {
        if value.len() > MAX_FRAME_BYTES as usize {
            return Err(NodeError::Codec("oversized bytes field".into()));
        }
        self.u32(value.len() as u32);
        self.buf.extend_from_slice(value);
        Ok(())
    }

    pub fn bytes32(&mut self, value: &[u8; 32]) {
        self.buf.extend_from_slice(value);
    }

    pub fn bytes64(&mut self, value: &[u8; 64]) {
        self.buf.extend_from_slice(value);
    }

    pub fn string(&mut self, value: &str) -> NodeResult<()> {
        if value.len() > MAX_STRING_BYTES {
            return Err(NodeError::Codec("oversized string".into()));
        }
        self.u16(value.len() as u16);
        self.buf.extend_from_slice(value.as_bytes());
        Ok(())
    }

    pub fn finish(self) -> Vec<u8> {
        self.buf
    }
}

pub struct Reader<'a> {
    buf: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    pub fn new(buf: &'a [u8]) -> Self {
        Self { buf, pos: 0 }
    }

    fn need(&self, n: usize) -> NodeResult<()> {
        if self.pos.saturating_add(n) > self.buf.len() {
            return Err(NodeError::Codec("truncated field".into()));
        }
        Ok(())
    }

    pub fn u8(&mut self) -> NodeResult<u8> {
        self.need(1)?;
        let v = self.buf[self.pos];
        self.pos += 1;
        Ok(v)
    }

    pub fn u16(&mut self) -> NodeResult<u16> {
        self.need(2)?;
        let v = u16::from_be_bytes([self.buf[self.pos], self.buf[self.pos + 1]]);
        self.pos += 2;
        Ok(v)
    }

    pub fn u32(&mut self) -> NodeResult<u32> {
        self.need(4)?;
        let v = u32::from_be_bytes(self.buf[self.pos..self.pos + 4].try_into().unwrap());
        self.pos += 4;
        Ok(v)
    }

    pub fn u64(&mut self) -> NodeResult<u64> {
        self.need(8)?;
        let v = u64::from_be_bytes(self.buf[self.pos..self.pos + 8].try_into().unwrap());
        self.pos += 8;
        Ok(v)
    }

    pub fn bytes32(&mut self) -> NodeResult<[u8; 32]> {
        self.need(32)?;
        let mut out = [0u8; 32];
        out.copy_from_slice(&self.buf[self.pos..self.pos + 32]);
        self.pos += 32;
        Ok(out)
    }

    pub fn bytes64(&mut self) -> NodeResult<[u8; 64]> {
        self.need(64)?;
        let mut out = [0u8; 64];
        out.copy_from_slice(&self.buf[self.pos..self.pos + 64]);
        self.pos += 64;
        Ok(out)
    }

    pub fn bytes(&mut self) -> NodeResult<Vec<u8>> {
        let len = self.u32()? as usize;
        if len > MAX_FRAME_BYTES as usize {
            return Err(NodeError::Codec("oversized bytes field".into()));
        }
        self.need(len)?;
        let out = self.buf[self.pos..self.pos + len].to_vec();
        self.pos += len;
        Ok(out)
    }

    pub fn string(&mut self) -> NodeResult<String> {
        let len = self.u16()? as usize;
        if len > MAX_STRING_BYTES {
            return Err(NodeError::Codec("oversized string".into()));
        }
        self.need(len)?;
        let slice = &self.buf[self.pos..self.pos + len];
        self.pos += len;
        String::from_utf8(slice.to_vec()).map_err(|_| NodeError::Codec("non-utf8 string".into()))
    }

    pub fn finish(self) -> NodeResult<()> {
        if self.pos != self.buf.len() {
            return Err(NodeError::Codec("trailing bytes".into()));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_roundtrip() {
        let frame = Frame {
            channel: Channel::TransactionGossip,
            flags: 7,
            payload: b"hello".to_vec(),
        };
        let encoded = encode_frame(&frame).unwrap();
        assert_eq!(decode_frame(&encoded).unwrap(), frame);
    }

    #[test]
    fn rejects_bad_magic() {
        let mut raw = encode_frame(&Frame {
            channel: Channel::PeerControl,
            flags: 0,
            payload: vec![1],
        })
        .unwrap();
        raw[0] = b'X';
        assert!(decode_frame(&raw).is_err());
    }
}
