.PHONY: install help

# Capture additional arguments (e.g., make install /path/to/install)
ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
$(eval $(ARGS):;@:)

# Installation path - appends /.ralph to the provided path
BASE_PATH ?= $(if $(ARGS),$(ARGS),.)
INSTALL_PATH := $(BASE_PATH)/.ralph

help:
	@echo "Available targets:"
	@echo "  make install              Install to ./.ralph (default)"
	@echo "  make install /path/to/dir Install to /path/to/dir/.ralph"
	@echo ""
	@echo "Examples:"
	@echo "  make install ~"
	@echo "  → Installs to ~/.ralph"
	@echo ""
	@echo "Note: Existing tasks are preserved during installation"

install:
	@echo "Installing to: $(INSTALL_PATH)"
	@mkdir -p "$(INSTALL_PATH)"
	@# Copy bin and .gitignore, preserve existing tasks directory
	@cp -r src/bin "$(INSTALL_PATH)/"
	@cp src/.gitignore "$(INSTALL_PATH)/" 2>/dev/null || true
	@if [ ! -d "$(INSTALL_PATH)/tasks" ]; then \
		mkdir -p "$(INSTALL_PATH)/tasks"; \
	else \
		echo "  ℹ️  Preserving existing tasks directory"; \
	fi
	@echo "✓ Installation complete"
