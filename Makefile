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
	@# Preserve existing tasks directory if present
	@if [ -d "$(INSTALL_PATH)/tasks" ]; then \
		echo "  ℹ️  Preserving existing tasks directory"; \
		for item in src/*; do \
			if [ "$$(basename $$item)" != "tasks" ]; then \
				cp -r "$$item" "$(INSTALL_PATH)/"; \
			fi \
		done; \
	else \
		cp -r src/* "$(INSTALL_PATH)"; \
	fi
	@echo "✓ Installation complete"
