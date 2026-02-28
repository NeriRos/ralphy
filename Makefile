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

install:
	@echo "Installing to: $(INSTALL_PATH)"
	@mkdir -p "$(INSTALL_PATH)"
	@cp -r src/* "$(INSTALL_PATH)"
	@echo "✓ Installation complete"
