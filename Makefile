.PHONY: help up down dev dev-down build logs logs-back logs-front shell migrate seed clean reset

help: ## Afficher l'aide
	@echo ""
	@echo "  SchoolPro — Commandes Docker"
	@echo "  ─────────────────────────────"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""

up: ## Démarrer en production
	docker compose up -d --build
	@echo ""
	@echo "✅ SchoolPro démarré !"
	@echo "   App      → http://localhost:3000"
	@echo "   API      → http://localhost:8000/api"
	@echo "   Admin    → http://localhost:8000/admin"
	@echo ""

down: ## Arrêter tous les conteneurs
	docker compose down

dev: ## Démarrer en mode développement (hot reload)
	docker compose -f docker-compose.dev.yml up --build

dev-down: ## Arrêter le mode développement
	docker compose -f docker-compose.dev.yml down

build: ## Reconstruire les images sans cache
	docker compose build --no-cache

logs: ## Voir les logs (tous les services)
	docker compose logs -f

logs-back: ## Logs du backend
	docker compose logs -f backend

logs-front: ## Logs du frontend
	docker compose logs -f frontend

shell: ## Shell dans le backend
	docker compose exec backend bash

migrate: ## Lancer les migrations
	docker compose exec backend python manage.py migrate

seed: ## Charger les données de test
	docker compose exec backend python manage.py seed_data

clean: ## Supprimer conteneurs + volumes + images
	docker compose down -v --rmi local
	docker compose -f docker-compose.dev.yml down -v --rmi local 2>/dev/null || true
	@echo "🧹 Nettoyage terminé"

reset: ## Réinitialiser la base de données
	docker compose down -v
	docker compose up -d --build
	@echo "✅ Base réinitialisée"
