.PHONY: install help

# Capture additional arguments (e.g., make install /path/to/install)
ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
$(eval $(ARGS):;@:)

# Installation path - appends /ralphy to the provided path
BASE_PATH ?= $(if $(ARGS),$(ARGS),.)
INSTALL_PATH := $(BASE_PATH)/ralphy

help:
	@echo "Available targets:"
	@echo "  make install              Install to ./ralphy (default)"
	@echo "  make install /path/to/dir Install to /path/to/dir/ralphy"
	@echo ""
	@echo "Examples:"
	@echo "  make install ~/projects/my-project"
	@echo "  → Installs to ~/projects/my-project/ralphy"
	@echo ""
	@echo "Note: Existing tasks are preserved during installation"

install:
	@echo "Installing to: $(INSTALL_PATH)"
	@mkdir -p "$(INSTALL_PATH)"
	@# Preserve existing tasks directory if present
	@if [ -d "$(INSTALL_PATH)/tasks" ]; then \
		echo "  ℹ️  Preserving existing tasks directory"; \
		cp -r src/* "$(INSTALL_PATH)" --exclude=tasks; \
	else \
		cp -r src/* "$(INSTALL_PATH)"; \
	fi
	@echo "✓ Installation complete"
