"""Signature et vérification des codes d'activation de licence (hors-ligne).

Un code encode : identifiant machine + date d'expiration.

Deux schémas, choisis automatiquement :
  • **Ed25519 (asymétrique, recommandé)** — actif dès que `LICENSE_PUBLIC_KEY`
    est configuré. La clé privée reste chez l'éditeur (génère les codes) ; seule
    la clé **publique** est embarquée dans l'app (vérifie). Impossible de forger
    un code même avec le code source.
  • **HMAC-SHA256 (symétrique, repli)** — si aucune clé publique n'est
    configurée (dev). Le secret partagé (`LICENSE_SIGNING_SECRET`) permet la
    vérification mais aussi la génération : à réserver au développement.

Format du code : base64url(payload_json) + '.' + base64url(signature)
Le payload inclut `alg` = 'ed25519' | 'hmac' pour lever toute ambiguïté.
"""
import base64
import hashlib
import hmac
import json

from django.conf import settings


# ── Utilitaires base64url ─────────────────────────────────────────────────────

def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode('ascii').rstrip('=')


def _b64d(s: str) -> bytes:
    pad = '=' * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _payload_b64(machine_id: str, expires: str, alg: str) -> str:
    payload = {'m': str(machine_id), 'exp': str(expires), 'alg': alg, 'v': 1}
    return _b64e(json.dumps(payload, separators=(',', ':'), sort_keys=True).encode('utf-8'))


# ── Chargement des clés Ed25519 ───────────────────────────────────────────────

def _load_public_key():
    pem = getattr(settings, 'LICENSE_PUBLIC_KEY', '') or ''
    if not pem.strip():
        return None
    try:
        from cryptography.hazmat.primitives.serialization import load_pem_public_key
        return load_pem_public_key(pem.encode('utf-8'))
    except Exception:
        return None


def _load_private_key():
    pem = getattr(settings, 'LICENSE_PRIVATE_KEY', '') or ''
    if not pem.strip():
        return None
    try:
        from cryptography.hazmat.primitives.serialization import load_pem_private_key
        return load_pem_private_key(pem.encode('utf-8'), password=None)
    except Exception:
        return None


# ── HMAC (repli) ──────────────────────────────────────────────────────────────

def _hmac_digest(payload_b64: str) -> str:
    secret = (getattr(settings, 'LICENSE_SIGNING_SECRET', '') or '').encode('utf-8')
    return _b64e(hmac.new(secret, payload_b64.encode('ascii'), hashlib.sha256).digest())


# ── API publique ──────────────────────────────────────────────────────────────

def active_scheme() -> str:
    """'ed25519' si une clé publique est configurée, sinon 'hmac'."""
    return 'ed25519' if _load_public_key() is not None else 'hmac'


def make_code(machine_id: str, expires: str) -> str:
    """Génère un code d'activation. `expires` = 'YYYY-MM-DD'.

    Utilise Ed25519 si `LICENSE_PRIVATE_KEY` est configurée, sinon HMAC.
    """
    priv = _load_private_key()
    if priv is not None:
        payload_b64 = _payload_b64(machine_id, expires, 'ed25519')
        sig = priv.sign(payload_b64.encode('ascii'))
        return f"{payload_b64}.{_b64e(sig)}"
    # Repli HMAC
    payload_b64 = _payload_b64(machine_id, expires, 'hmac')
    return f"{payload_b64}.{_hmac_digest(payload_b64)}"


def verify_code(code: str):
    """Vérifie un code. Retourne le payload {m, exp, alg, v} si valide, sinon None."""
    if not code or '.' not in code:
        return None
    payload_b64, sig = code.strip().split('.', 1)
    try:
        payload = json.loads(_b64d(payload_b64).decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        return None
    if not isinstance(payload, dict) or 'm' not in payload or 'exp' not in payload:
        return None

    alg = payload.get('alg', 'hmac')
    if alg == 'ed25519':
        pub = _load_public_key()
        if pub is None:
            return None  # code asymétrique mais pas de clé publique → refus
        try:
            from cryptography.exceptions import InvalidSignature
            pub.verify(_b64d(sig), payload_b64.encode('ascii'))
        except InvalidSignature:
            return None
        except Exception:
            return None
        return payload

    # HMAC : refuse si une clé publique est configurée (mode asymétrique attendu)
    if _load_public_key() is not None:
        return None
    if hmac.compare_digest(_hmac_digest(payload_b64), sig):
        return payload
    return None
