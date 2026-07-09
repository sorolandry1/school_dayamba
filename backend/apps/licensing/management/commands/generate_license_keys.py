"""Génère une paire de clés Ed25519 pour la signature des licences.

    python manage.py generate_license_keys

Sortie : clé privée (PEM) et clé publique (PEM).
 - Conservez la clé PRIVÉE secrète (uniquement sur le poste de l'éditeur) →
   sert à générer les codes d'activation.
 - Embarquez la clé PUBLIQUE dans le build livré via l'environnement :
       LICENSE_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Génère une paire de clés Ed25519 (licence)."

    def handle(self, *args, **opts):
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        from cryptography.hazmat.primitives import serialization

        priv = Ed25519PrivateKey.generate()
        priv_pem = priv.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode('ascii')
        pub_pem = priv.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode('ascii')

        self.stdout.write(self.style.WARNING('=== CLÉ PRIVÉE (à garder secrète, éditeur uniquement) ==='))
        self.stdout.write(priv_pem)
        self.stdout.write(self.style.SUCCESS('=== CLÉ PUBLIQUE (à embarquer dans le build livré) ==='))
        self.stdout.write(pub_pem)
        self.stdout.write(self.style.NOTICE(
            'Astuce : pour une variable d\'environnement, remplacez les sauts de ligne par \\n.'
        ))
