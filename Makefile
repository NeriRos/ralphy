.PHONY: install help build copy-bin copy-assets init-tasks configure-mcp configure-package

# Capture additional arguments (e.g., make install /path/to/install)
ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
$(eval $(ARGS):;@:)

# Installation path - appends /.ralph to the provided path
BASE_PATH ?= $(if $(ARGS),$(ARGS),.)
INSTALL_PATH := $(BASE_PATH)/.ralph

# --- Targets ---

help:
	@echo "Available targets:"
	@echo "  make install              Install to ./.ralph (default)"
	@echo "  make install /path/to/dir Install to /path/to/dir/.ralph"
	@echo ""
	@echo "Examples:"
	@echo "  make install ~"
	@echo "  → Installs to ~/.ralph"

install: build copy-bin copy-assets init-tasks configure-mcp configure-package
	@echo "✓ Installation complete at $(INSTALL_PATH)"

build:
	@echo "Building..."
	@bunx nx run-many --target=build --projects=cli,mcp --output-style=stream

copy-bin:
	@mkdir -p "$(INSTALL_PATH)/bin"
	@cp dist/cli/index.js "$(INSTALL_PATH)/bin/cli.js"
	@cp dist/mcp/index.js "$(INSTALL_PATH)/bin/mcp.js"
	@echo "  ✓ Copied binaries"

copy-assets:
	@rm -rf "$(INSTALL_PATH)/phases" "$(INSTALL_PATH)/templates/checklists"
	@cp -r packages/phases/phases "$(INSTALL_PATH)/phases"
	@mkdir -p "$(INSTALL_PATH)/templates"
	@cp -r packages/phases/checklists "$(INSTALL_PATH)/templates/checklists"
	@cp -r packages/core/templates/* "$(INSTALL_PATH)/templates/"
	@mv "$(INSTALL_PATH)/templates/README.md" "$(INSTALL_PATH)/README.md"
	@echo "  ✓ Copied assets"

init-tasks:
	@if [ ! -d "$(INSTALL_PATH)/tasks" ]; then \
		mkdir -p "$(INSTALL_PATH)/tasks"; \
	else \
		echo "  ℹ️  Preserving existing tasks directory"; \
	fi
	@touch "$(INSTALL_PATH)/tasks/.gitkeep"

configure-mcp:
	@MCP_FILE="$(BASE_PATH)/.mcp.json"; \
	ENTRY="{\"type\":\"stdio\",\"command\":\"bun\",\"args\":[\".ralph/bin/mcp.js\"],\"env\":{}}"; \
	if [ -f "$$MCP_FILE" ]; then \
		jq --argjson ralph "$$ENTRY" '.mcpServers.ralph = $$ralph' "$$MCP_FILE" > "$$MCP_FILE.tmp" && \
		mv "$$MCP_FILE.tmp" "$$MCP_FILE"; \
	else \
		echo "{}" | jq --argjson ralph "$$ENTRY" '.mcpServers.ralph = $$ralph' > "$$MCP_FILE"; \
	fi
	@echo "  ✓ MCP server configured in .mcp.json"

configure-package:
	@if [ -f "$(BASE_PATH)/package.json" ] && command -v jq &> /dev/null; then \
		jq '.scripts.ralph = "bun .ralph/bin/cli.js"' "$(BASE_PATH)/package.json" > "$(BASE_PATH)/package.json.tmp" && \
		mv "$(BASE_PATH)/package.json.tmp" "$(BASE_PATH)/package.json"; \
		echo "  ✓ Added ralph script to package.json"; \
	fi
