# Canonical hawk-eco Makefile for TypeScript repos.
# Source of truth: https://github.com/GrayCodeAI/hawk/blob/main/.shared-templates/Makefile.typescript.tmpl
# Placeholders rendered per repo: hawk-sdk-typescript.

# ---------------------------------------------------------------------------
# Project metadata
# ---------------------------------------------------------------------------
NAME := hawk-sdk-typescript

# ---------------------------------------------------------------------------
# Versioning — sourced from VERSION file at repo root.
# ---------------------------------------------------------------------------
VERSION ?= $(shell cat VERSION 2>/dev/null | head -n1 | tr -d '[:space:]' || echo "dev")

NODE ?= node
NPM  ?= npm

# ---------------------------------------------------------------------------
# Phony declarations (alphabetical).
# ---------------------------------------------------------------------------
.PHONY: all build ci clean fmt help install lint lint-fix release security test test-race tidy version vet

# ---------------------------------------------------------------------------
# Default target.
# ---------------------------------------------------------------------------
all: lint test build ## Default — lint, test, build.

# ---------------------------------------------------------------------------
# Build / install / release.
# ---------------------------------------------------------------------------
build: ## Build the library into dist/.
	$(NPM) run build

install: ## Install dependencies.
	$(NPM) install

# ---------------------------------------------------------------------------
# Tests.
# ---------------------------------------------------------------------------
test: ## Run unit tests.
	$(NPM) test

test-race: test ## Alias for `test` (Node.js has no race detector).

# ---------------------------------------------------------------------------
# Quality gates.
# ---------------------------------------------------------------------------
fmt: ## Format with prettier.
	$(NPM) run format

vet: ## Type-check with TypeScript.
	$(NPM) run typecheck

lint: ## Lint with ruff.
	$(NPM) run lint

lint-fix: ## Lint with ruff --fix.
	$(NPM) run lint -- --fix

security: ## Run npm audit.
	$(NPM) audit --audit-level=high

tidy: ## No-op for TypeScript repos.
	@echo "tidy: nothing to do for TypeScript repos."

# ---------------------------------------------------------------------------
# Composite gate used by CI and pre-push.
# ---------------------------------------------------------------------------
ci: fmt vet lint test security ## Run everything CI runs.
	@echo "All CI checks passed."

# ---------------------------------------------------------------------------
# Misc.
# ---------------------------------------------------------------------------
version: ## Print the version that will be packaged.
	@echo "Version: $(VERSION)"

clean: ## Remove build artefacts and caches.
	rm -rf dist/ coverage/ node_modules/.cache
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

help: ## Show this help.
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

.PHONY: hooks
hooks: ## Install git hooks via lefthook.
	@command -v lefthook >/dev/null 2>&1 || (echo "install: go install github.com/evilmartians/lefthook@latest" && exit 1)
	git config --unset core.hooksPath 2>/dev/null || true
	lefthook install
