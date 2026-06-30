class EcoleScopedMixin:
    """Restreint les querysets d'un ViewSet à l'école de l'utilisateur connecté.

    - ADMIN (super-admin plateforme) voit toutes les écoles ; il peut filtrer
      avec `?ecole=<id>`.
    - Les autres rôles ne voient que les données de leur école.

    `ecole_lookup` : chemin ORM vers l'école (par défaut 'ecole' ; sinon p.ex.
    'student__ecole' pour les modèles enfants sans FK directe).
    """
    ecole_lookup = 'ecole'

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, 'user', None)
        if not (user and user.is_authenticated):
            return qs
        if user.role == 'ADMIN':
            ecole_id = self.request.query_params.get('ecole')
            if ecole_id and str(ecole_id).isdigit():
                qs = qs.filter(**{self.ecole_lookup: int(ecole_id)})
            return qs
        if getattr(user, 'ecole_id', None):
            return qs.filter(**{self.ecole_lookup: user.ecole_id})
        return qs

    def ecole_save_kwargs(self):
        """kwargs à passer à serializer.save() pour rattacher l'objet à l'école
        (seulement si le modèle possède une FK directe `ecole`)."""
        user = self.request.user
        if self.ecole_lookup == 'ecole' and getattr(user, 'ecole_id', None):
            return {'ecole': user.ecole}
        return {}
