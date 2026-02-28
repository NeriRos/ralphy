.PHONY: install help

# Capture additional arguments (e.g., make install /path/to/install)
ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
$(eval $(ARGS):;@:)

# Default installation path
INSTALL_PATH ?= $(if $(ARGS),$(ARGS),./ralphy)

help:
	@echo "Available targets:"
	@echo "  make install              Install to default path (./ralphy)"
	@echo "  make install /path/to/install"
	@echo "                            Install to custom path"
	@echo "  make install INSTALL_PATH=/path/to/install"
	@echo "                            Alternative syntax"
	@echo ""
	@echo "Examples:"
	@echo "  make install ~/projects/my-project"
	@echo "  make install INSTALL_PATH=~/projects/my-project"

install:
	@echo "Installing to: $(INSTALL_PATH)"
	@mkdir -p "$(INSTALL_PATH)"
	@cp -r src/* "$(INSTALL_PATH)"
	@echo "✓ Installation complete"
