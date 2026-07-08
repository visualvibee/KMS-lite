import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MASTER_KEY_ENV_VAR = "KMS_LITE_MASTER_KEY"
NONCE_SIZE_BYTES = 12
CURRENT_KEY_ID = "kms-master-v1"

_MASTER_KEY: bytes | None = None


def _load_master_key() -> bytes:
    key_b64 = os.environ.get(MASTER_KEY_ENV_VAR)
    if not key_b64:
        raise RuntimeError(f"Missing {MASTER_KEY_ENV_VAR} env var")
    key = base64.b64decode(key_b64)
    if len(key) != 32:
        raise RuntimeError("Master key must decode to 32 bytes (AES-256)")
    return key


def get_master_key() -> bytes:
    global _MASTER_KEY
    if _MASTER_KEY is None:
        _MASTER_KEY = _load_master_key()
    return _MASTER_KEY


def encrypt_value(plaintext: str) -> str:
    if plaintext is None:
        return None

    key = get_master_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(NONCE_SIZE_BYTES)

    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    payload = nonce + ciphertext
    return base64.b64encode(payload).decode("utf-8")


def decrypt_value(stored_value: str) -> str:
    if stored_value is None:
        return None

    key = get_master_key()
    aesgcm = AESGCM(key)

    raw = base64.b64decode(stored_value)
    nonce = raw[:NONCE_SIZE_BYTES]
    ciphertext = raw[NONCE_SIZE_BYTES:]

    plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext_bytes.decode("utf-8")


if __name__ == "__main__":
    os.environ.setdefault(MASTER_KEY_ENV_VAR, base64.b64encode(os.urandom(32)).decode())
    sample = "123-45-6789"
    enc = encrypt_value(sample)
    dec = decrypt_value(enc)
    print(f"Original:  {sample}")
    print(f"Encrypted: {enc}")
    print(f"Decrypted: {dec}")
    assert dec == sample
    print("Round-trip OK")