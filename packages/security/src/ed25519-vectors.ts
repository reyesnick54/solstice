/**
 * RFC 8032 §7.1 test vectors for Ed25519.
 * Secret/public keys and signatures are public test fixtures, not
 * operational key material.
 */

export const RFC8032_ED25519_TEST1 = Object.freeze({
  name: 'RFC 8032 §7.1 TEST 1 (empty message)',
  secretKeyHex: '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
  publicKeyHex: 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
  messageHex: '',
  signatureHex:
    'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b',
});

export const RFC8032_ED25519_TEST3 = Object.freeze({
  name: 'RFC 8032 §7.1 TEST 3 (two-byte message)',
  secretKeyHex: 'c5aa8df43f9f307eb5cd3afaace33c61cac413687655eab6007a8a4db31891dc',
  publicKeyHex: 'fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025',
  messageHex: 'af82',
  signatureHex:
    '6291d657deec24024827e69c3abe01a30ce548a284743a445e3680d7db5ac3ac18ff9b538d16f290ae67f760984dc6594a7c15e9716ed28dc027beceea1ec40a',
});

export const RFC8032_ED25519_VECTORS = Object.freeze([
  RFC8032_ED25519_TEST1,
  RFC8032_ED25519_TEST3,
]);
