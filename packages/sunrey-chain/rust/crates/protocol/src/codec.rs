use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum CodecError {
    #[error("unexpected end of buffer")]
    UnexpectedEof,
    #[error("string is not valid UTF-8")]
    InvalidUtf8,
    #[error("boolean must be 0x00 or 0x01")]
    InvalidBool,
    #[error("length exceeds remaining buffer")]
    LengthOverflow,
}

pub fn encode_u32(out: &mut Vec<u8>, value: u32) {
    out.extend_from_slice(&value.to_be_bytes());
}

pub fn encode_u64(out: &mut Vec<u8>, value: u64) {
    out.extend_from_slice(&value.to_be_bytes());
}

pub fn encode_u128(out: &mut Vec<u8>, value: u128) {
    out.extend_from_slice(&value.to_be_bytes());
}

pub fn encode_bool(out: &mut Vec<u8>, value: bool) {
    out.push(if value { 1 } else { 0 });
}

pub fn encode_bytes(out: &mut Vec<u8>, value: &[u8]) {
    encode_u32(out, value.len() as u32);
    out.extend_from_slice(value);
}

pub fn encode_string(out: &mut Vec<u8>, value: &str) {
    encode_bytes(out, value.as_bytes());
}

pub fn decode_u32(input: &mut &[u8]) -> Result<u32, CodecError> {
    if input.len() < 4 {
        return Err(CodecError::UnexpectedEof);
    }
    let (head, rest) = input.split_at(4);
    *input = rest;
    Ok(u32::from_be_bytes(head.try_into().expect("4 bytes")))
}

pub fn decode_u64(input: &mut &[u8]) -> Result<u64, CodecError> {
    if input.len() < 8 {
        return Err(CodecError::UnexpectedEof);
    }
    let (head, rest) = input.split_at(8);
    *input = rest;
    Ok(u64::from_be_bytes(head.try_into().expect("8 bytes")))
}

pub fn decode_u128(input: &mut &[u8]) -> Result<u128, CodecError> {
    if input.len() < 16 {
        return Err(CodecError::UnexpectedEof);
    }
    let (head, rest) = input.split_at(16);
    *input = rest;
    Ok(u128::from_be_bytes(head.try_into().expect("16 bytes")))
}

pub fn decode_bool(input: &mut &[u8]) -> Result<bool, CodecError> {
    if input.is_empty() {
        return Err(CodecError::UnexpectedEof);
    }
    let value = input[0];
    *input = &input[1..];
    match value {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(CodecError::InvalidBool),
    }
}

pub fn decode_bytes(input: &mut &[u8]) -> Result<Vec<u8>, CodecError> {
    let len = decode_u32(input)? as usize;
    if input.len() < len {
        return Err(CodecError::LengthOverflow);
    }
    let (head, rest) = input.split_at(len);
    *input = rest;
    Ok(head.to_vec())
}

pub fn decode_string(input: &mut &[u8]) -> Result<String, CodecError> {
    let bytes = decode_bytes(input)?;
    String::from_utf8(bytes).map_err(|_| CodecError::InvalidUtf8)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_primitives() {
        let mut buf = Vec::new();
        encode_u32(&mut buf, 7);
        encode_u64(&mut buf, 99);
        encode_u128(&mut buf, 123);
        encode_bool(&mut buf, true);
        encode_string(&mut buf, "sunrey");
        encode_bytes(&mut buf, &[1, 2, 3]);
        let mut view = buf.as_slice();
        assert_eq!(decode_u32(&mut view).unwrap(), 7);
        assert_eq!(decode_u64(&mut view).unwrap(), 99);
        assert_eq!(decode_u128(&mut view).unwrap(), 123);
        assert!(decode_bool(&mut view).unwrap());
        assert_eq!(decode_string(&mut view).unwrap(), "sunrey");
        assert_eq!(decode_bytes(&mut view).unwrap(), vec![1, 2, 3]);
        assert!(view.is_empty());
    }
}
