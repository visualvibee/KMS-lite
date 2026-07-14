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


def generate_dek() -> bytes:
    return os.urandom(32)


def wrap_key(raw_key: bytes) -> str:
    kek = get_master_key()
    aesgcm = AESGCM(kek)
    nonce = os.urandom(NONCE_SIZE_BYTES)
    wrapped = aesgcm.encrypt(nonce, raw_key, None)
    return base64.b64encode(nonce + wrapped).decode("utf-8")


def unwrap_key(wrapped_b64: str) -> bytes:
    kek = get_master_key()
    aesgcm = AESGCM(kek)
    raw = base64.b64decode(wrapped_b64)
    nonce = raw[:NONCE_SIZE_BYTES]
    wrapped = raw[NONCE_SIZE_BYTES:]
    return aesgcm.decrypt(nonce, wrapped, None)


def _encrypt_with_key(plaintext: str, key: bytes) -> str:
    aesgcm = AESGCM(key)
    nonce = os.urandom(NONCE_SIZE_BYTES)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("utf-8")


def _decrypt_with_key(stored_value: str, key: bytes) -> str:
    aesgcm = AESGCM(key)
    raw = base64.b64decode(stored_value)
    nonce = raw[:NONCE_SIZE_BYTES]
    ciphertext = raw[NONCE_SIZE_BYTES:]
    return aesgcm.decrypt(nonce, ciphertext, None).decode("utf-8")


def encrypt_value(plaintext: str, wrapped_key: str | None = None) -> str:
    if plaintext is None:
        return None
    if wrapped_key is None:
        key = get_master_key()
    else:
        key = unwrap_key(wrapped_key)
    return _encrypt_with_key(plaintext, key)


def decrypt_value(stored_value: str, wrapped_key: str | None = None) -> str:
    if stored_value is None:
        return None
    if wrapped_key is None:
        key = get_master_key()
    else:
        key = unwrap_key(wrapped_key)
    return _decrypt_with_key(stored_value, key)