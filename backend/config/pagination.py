from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """Pagination par défaut autorisant le client à ajuster la taille de page
    via `?page_size=N` (plafonné), utile pour charger des listes complètes
    (ex. toutes les matières dans un sélecteur)."""
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 1000
