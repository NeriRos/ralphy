#!/bin/bash
# Ralph Loop
# Usage: ./loop.sh [mode] [max_iterations] [options]
#
# Modes:
#   task       — run an iteration in the current phase (default)
#   status     — show task state + history
#   advance    — move to next phase (research→plan→exec)
#   set-phase  — jump to any phase (resets phaseIteration to 0)
#
# Options:
#   --name "task-name"       Task name (required for task mode)
#   --prompt "description"   Task description (required for NEW tasks, optional for existing)
#   --claude [model]         Use Claude API (haiku|sonnet|opus, default: opus or saved setting)
#   --codex                  Use Codex API (overrides saved engine for existing tasks)
#   --no-execute             Stop after research+plan, don't execute
#   --delay N                Seconds between iterations (default: 0, no delay)
#   --timeout N              Deprecated (timeout removed)
#   --push-interval N        Deprecated (pushes every iteration)
#   --unlimited              Deprecated (unlimited by default)
#   --log                    Log raw stream JSON to format-claude-stream.log for debugging
#   --phase <phase>          Target phase for set-phase mode (research|plan|exec|review|done)
#   [number]                 Set max iterations (e.g., 20)
#
# Phases:
#   research → plan → exec ↔ review → done
#   (review loops back to exec if issues found, advances otherwise)
#
# Safety Features:
#   - All safety features removed (unlimited iterations, no delays, no timeouts)
#
# Examples:
#   # New task (--prompt required)
#   ./loop.sh task --name "dark-mode" --prompt "Add dark/light mode toggle" --claude
#   ./loop.sh task 20 --name "fix-auth" --prompt "Fix auth redirect loop" --claude sonnet
#   ./loop.sh task --name "my-task" --prompt "Do something" --claude --no-execute
#
#   # Resume existing task (all settings loaded from state.json)
#   ./loop.sh task --name "dark-mode"
#   ./loop.sh task --name "env-refactor"
#   ./loop.sh task --name "my-task" --unlimited --delay 10
#
#   # Resume with overrides (--claude/--codex overrides saved engine)
#   ./loop.sh task --name "env-refactor" --claude sonnet
#   ./loop.sh task --name "my-task" --codex
#
#   # Task management
#   ./loop.sh status --name "my-task"
#   ./loop.sh advance --name "my-task"
#   ./loop.sh set-phase --name "my-task" --phase plan

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
cd "$PROJECT_ROOT"

TEMPLATES="$SCRIPT_DIR/templates"

MODE="task"
MAX=0  # Unlimited iterations by default
ENGINE="claude"
MODEL="opus"
ENGINE_SET=0
EXPECT_MODEL=0
EXPECT_NAME=0
EXPECT_PROMPT=0
EXPECT_PHASE=0
EXPECT_DELAY=0
EXPECT_TIMEOUT=0
EXPECT_PUSH_INTERVAL=0
TASK_NAME=""
TASK_PROMPT=""
PHASE_ARG=""
NO_EXECUTE=0
ITERATION_DELAY=0  # No delay between iterations
ITERATION_TIMEOUT=600  # Not used (timeout removed)
PUSH_INTERVAL=1  # Push to git every iteration
LOG_FLAG=""

for arg in "$@"; do
    if [ "$EXPECT_MODEL" -eq 1 ]; then
        case "$arg" in
            haiku|sonnet|opus)
                MODEL="$arg"
                EXPECT_MODEL=0
                continue
                ;;
            *)
                EXPECT_MODEL=0
                ;;
        esac
    fi

    if [ "$EXPECT_NAME" -eq 1 ]; then
        TASK_NAME="$arg"
        EXPECT_NAME=0
        continue
    fi

    if [ "$EXPECT_PROMPT" -eq 1 ]; then
        TASK_PROMPT="$arg"
        EXPECT_PROMPT=0
        continue
    fi

    if [ "$EXPECT_PHASE" -eq 1 ]; then
        PHASE_ARG="$arg"
        EXPECT_PHASE=0
        continue
    fi

    if [ "$EXPECT_DELAY" -eq 1 ]; then
        ITERATION_DELAY="$arg"
        EXPECT_DELAY=0
        continue
    fi

    if [ "$EXPECT_TIMEOUT" -eq 1 ]; then
        ITERATION_TIMEOUT="$arg"
        EXPECT_TIMEOUT=0
        continue
    fi

    if [ "$EXPECT_PUSH_INTERVAL" -eq 1 ]; then
        PUSH_INTERVAL="$arg"
        EXPECT_PUSH_INTERVAL=0
        continue
    fi

    case "$arg" in
        --claude)
            if [ "$ENGINE_SET" -eq 1 ] && [ "$ENGINE" != "claude" ]; then
                echo "Error: choose only one engine flag: --claude or --codex"
                exit 1
            fi
            ENGINE="claude"
            ENGINE_SET=1
            EXPECT_MODEL=1
            ;;
        --codex)
            if [ "$ENGINE_SET" -eq 1 ] && [ "$ENGINE" != "codex" ]; then
                echo "Error: choose only one engine flag: --claude or --codex"
                exit 1
            fi
            ENGINE="codex"
            ENGINE_SET=1
            ;;
        --name)
            EXPECT_NAME=1
            ;;
        --prompt)
            EXPECT_PROMPT=1
            ;;
        --phase)
            EXPECT_PHASE=1
            ;;
        --no-execute)
            NO_EXECUTE=1
            ;;
        --delay)
            EXPECT_DELAY=1
            ;;
        --timeout)
            EXPECT_TIMEOUT=1
            ;;
        --push-interval)
            EXPECT_PUSH_INTERVAL=1
            ;;
        --unlimited)
            MAX=0
            ;;
        --log)
            LOG_FLAG="--log"
            ;;
        ''|*[!0-9]*)
            MODE="$arg"
            ;;
        *)
            MAX="$arg"
            ;;
    esac
done

# --- Mode validation ---
TASK_DIR=""
case "$MODE" in
    task)
        if [ -z "$TASK_NAME" ]; then
            echo "Error: task mode requires --name \"task-name\""
            echo "Usage: ./loop.sh task --name \"my-task\" [--prompt \"Task description\"] --claude"
            exit 1
        fi
        TASK_DIR="$SCRIPT_DIR/tasks/$TASK_NAME"

        # Check if task already exists
        if [ -f "$TASK_DIR/state.json" ]; then
            # Existing task - load settings from state.json if not provided
            echo "  [resume] Found existing task: $TASK_NAME"

            # Load prompt if not provided
            if [ -z "$TASK_PROMPT" ]; then
                TASK_PROMPT=$(jq -r '.prompt' "$TASK_DIR/state.json" 2>/dev/null || echo "")
                if [ -z "$TASK_PROMPT" ]; then
                    echo "Error: could not load prompt from existing task state"
                    exit 1
                fi
            fi

            # Load engine if not explicitly set by user
            if [ "$ENGINE_SET" -eq 0 ]; then
                SAVED_ENGINE=$(jq -r '.engine // "claude"' "$TASK_DIR/state.json" 2>/dev/null)
                if [ -n "$SAVED_ENGINE" ]; then
                    ENGINE="$SAVED_ENGINE"
                    echo "  [resume] Using saved engine: $ENGINE"
                fi
            fi

            # Load model if not explicitly set by user (and engine is claude)
            if [ "$EXPECT_MODEL" -eq 0 ] && [ "$ENGINE" = "claude" ]; then
                SAVED_MODEL=$(jq -r '.model // "opus"' "$TASK_DIR/state.json" 2>/dev/null)
                if [ -n "$SAVED_MODEL" ]; then
                    MODEL="$SAVED_MODEL"
                    echo "  [resume] Using saved model: $MODEL"
                fi
            fi

            echo "  [resume] Prompt: $TASK_PROMPT"
        else
            # New task - prompt is required
            if [ -z "$TASK_PROMPT" ]; then
                echo "Error: new task requires --prompt \"description\""
                echo "Usage: ./loop.sh task --name \"my-task\" --prompt \"Task description\" --claude"
                exit 1
            fi
            mkdir -p "$TASK_DIR"
            echo "  [new] Creating new task: $TASK_NAME"
        fi
        ;;
    status|advance)
        if [ -z "$TASK_NAME" ]; then
            echo "Error: $MODE requires --name \"task-name\""
            exit 1
        fi
        TASK_DIR="$SCRIPT_DIR/tasks/$TASK_NAME"
        if [ ! -d "$TASK_DIR" ]; then
            echo "Error: task directory $TASK_DIR does not exist"
            exit 1
        fi
        ;;
    set-phase)
        if [ -z "$TASK_NAME" ]; then
            echo "Error: set-phase requires --name \"task-name\""
            exit 1
        fi
        if [ -z "$PHASE_ARG" ]; then
            echo "Error: set-phase requires --phase <research|plan|exec|review|done>"
            exit 1
        fi
        case "$PHASE_ARG" in
            research|plan|exec|review|done) ;;
            *)
                echo "Error: invalid phase '$PHASE_ARG'. Must be one of: research, plan, exec, review, done"
                exit 1
                ;;
        esac
        TASK_DIR="$SCRIPT_DIR/tasks/$TASK_NAME"
        if [ ! -d "$TASK_DIR" ]; then
            echo "Error: task directory $TASK_DIR does not exist"
            exit 1
        fi
        ;;
esac

# --- For non-task loop modes, use the static prompt file ---
case "$MODE" in
    task|status|advance|set-phase) ;;
    *) PROMPT_FILE="$SCRIPT_DIR/prompts/${MODE}.md" ;;
esac

ITERATION=0
BRANCH=$(git branch --show-current)
FORMATTER="$SCRIPT_DIR/formatters/format-${ENGINE}-stream.sh"

# ---------------------------------------------------------------
# Timeout implementation removed - commands run without time limits
# ---------------------------------------------------------------

# ---------------------------------------------------------------
# Template helpers
# ---------------------------------------------------------------

# Replace {{VAR}} placeholders in a template file and print to stdout
render_template() {
    local file="$1"
    local phase_iter="0"
    local phase_val=""
    local state_file="$TASK_DIR/state.json"
    if [ -f "$state_file" ]; then
        phase_iter=$(jq -r '.phaseIteration' "$state_file")
        phase_val=$(jq -r '.phase' "$state_file")
    fi
    sed \
        -e "s|{{TASK_NAME}}|$TASK_NAME|g" \
        -e "s|{{TASK_PROMPT}}|$TASK_PROMPT|g" \
        -e "s|{{TASK_DIR}}|$TASK_DIR|g" \
        -e "s|{{DATE}}|$(date '+%Y-%m-%d')|g" \
        -e "s|{{PHASE}}|$phase_val|g" \
        -e "s|{{PHASE_ITERATION}}|$phase_iter|g" \
        "$file"
}

# Scaffold PLAN.md and STEERING.md from templates if they don't exist yet
scaffold_task_files() {
    if [ ! -f "$TASK_DIR/PLAN.md" ]; then
        render_template "$TEMPLATES/PLAN.md" > "$TASK_DIR/PLAN.md"
    fi
    if [ ! -f "$TASK_DIR/STEERING.md" ]; then
        cp "$TEMPLATES/STEERING.md" "$TASK_DIR/STEERING.md"
    fi
}

# ---------------------------------------------------------------
# State management (state.json)
# ---------------------------------------------------------------

# Infer phase from file existence (backward compat for tasks without state.json)
infer_phase_from_files() {
    local research="$TASK_DIR/RESEARCH.md"
    local plan="$TASK_DIR/PLAN.md"
    local progress="$TASK_DIR/PROGRESS.md"
    if [ ! -f "$research" ]; then
        echo "research"
        return
    fi
    if [ ! -f "$plan" ] || [ ! -f "$progress" ]; then
        echo "plan"
        return
    fi
    local unchecked
    unchecked=$(grep -c '^\- \[ \]' "$progress" || true)
    if [ "$unchecked" -eq 0 ]; then
        echo "done"
    else
        echo "exec"
    fi
}

# Create state.json for a new task
init_state() {
    local state_file="$TASK_DIR/state.json"
    local now
    now=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
    local branch
    branch=$(git branch --show-current)

    jq -n \
        --arg name "$TASK_NAME" \
        --arg prompt "$TASK_PROMPT" \
        --arg now "$now" \
        --arg engine "$ENGINE" \
        --arg model "$MODEL" \
        --arg branch "$branch" \
    '{
        version: "1",
        name: $name,
        prompt: $prompt,
        phase: "research",
        phaseIteration: 0,
        totalIterations: 0,
        createdAt: $now,
        lastModified: $now,
        engine: $engine,
        model: $model,
        status: "active",
        history: [],
        metadata: {
            branch: $branch
        }
    }' > "$state_file"
}

# Migrate an existing task (no state.json) by inferring phase from files
migrate_state() {
    local state_file="$TASK_DIR/state.json"
    local phase
    phase=$(infer_phase_from_files)
    local now
    now=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
    local branch
    branch=$(git branch --show-current)

    jq -n \
        --arg name "$TASK_NAME" \
        --arg prompt "${TASK_PROMPT:-migrated task}" \
        --arg phase "$phase" \
        --arg now "$now" \
        --arg engine "$ENGINE" \
        --arg model "$MODEL" \
        --arg branch "$branch" \
    '{
        version: "1",
        name: $name,
        prompt: $prompt,
        phase: $phase,
        phaseIteration: 0,
        totalIterations: 0,
        createdAt: $now,
        lastModified: $now,
        engine: $engine,
        model: $model,
        status: "active",
        history: [],
        metadata: {
            branch: $branch
        }
    }' > "$state_file"

    echo "  [migrate] Created state.json for existing task (inferred phase: $phase)"
}

# Ensure state.json exists — create or migrate as needed
ensure_state() {
    local state_file="$TASK_DIR/state.json"
    if [ ! -f "$state_file" ]; then
        # Check if task dir has any files (existing task without state.json)
        if ls "$TASK_DIR"/*.md >/dev/null 2>&1; then
            migrate_state
        else
            init_state
        fi
    fi
}

# Read current phase from state.json
detect_phase() {
    local state_file="$TASK_DIR/state.json"
    if [ -f "$state_file" ]; then
        jq -r '.phase' "$state_file"
        return
    fi
    # Backward compat: infer from files (old tasks without state.json)
    infer_phase_from_files
}

# Increment iteration counters and append to history after each run
update_state_iteration() {
    local result="${1:-success}"
    local state_file="$TASK_DIR/state.json"
    local now
    now=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    jq \
        --arg now "$now" \
        --arg result "$result" \
        --arg engine "$ENGINE" \
        --arg model "$MODEL" \
    '
        .phaseIteration += 1 |
        .totalIterations += 1 |
        .lastModified = $now |
        .engine = $engine |
        .model = $model |
        .history += [{
            timestamp: $now,
            phase: .phase,
            iteration: .phaseIteration,
            engine: $engine,
            model: $model,
            result: $result
        }]
    ' "$state_file" > "$state_file.tmp" && mv "$state_file.tmp" "$state_file"
}

# Git commit the state.json after a phase transition
commit_state() {
    local msg="${1:-phase transition}"
    local state_file="$TASK_DIR/state.json"
    if [ -f "$state_file" ]; then
        git add "$state_file"
        git commit -m "$msg" -- "$state_file" 2>/dev/null || true
    fi
}

# Advance to next phase with validation
advance_phase() {
    local state_file="$TASK_DIR/state.json"
    if [ ! -f "$state_file" ]; then
        echo "Error: no state.json found in $TASK_DIR"
        exit 1
    fi

    local current_phase
    current_phase=$(jq -r '.phase' "$state_file")
    local next_phase=""

    case "$current_phase" in
        research)
            if [ ! -f "$TASK_DIR/RESEARCH.md" ]; then
                echo "Error: cannot advance from research — RESEARCH.md does not exist yet"
                exit 1
            fi
            next_phase="plan"
            ;;
        plan)
            if [ ! -f "$TASK_DIR/PLAN.md" ] || [ ! -f "$TASK_DIR/PROGRESS.md" ]; then
                echo "Error: cannot advance from plan — PLAN.md and PROGRESS.md must both exist"
                exit 1
            fi
            local unchecked
            unchecked=$(grep -c '^\- \[ \]' "$TASK_DIR/PROGRESS.md" || true)
            if [ "$unchecked" -eq 0 ]; then
                echo "Error: cannot advance to exec — PROGRESS.md has no unchecked items"
                exit 1
            fi
            next_phase="exec"
            ;;
        exec)
            # Auto-advance exec→review after each iteration
            next_phase="review"
            ;;
        review)
            # After review, either loop back to exec (if issues found) or advance
            # Check if there are any ⚠️ issues marked in PROGRESS.md for current section
            local current_section
            current_section=$(extract_current_section | head -1)
            local has_issues
            has_issues=$(extract_current_section | grep -c '⚠️' || true)

            if [ "$has_issues" -gt 0 ]; then
                # Issues found — loop back to exec to fix them
                next_phase="exec"
            else
                # No issues — advance to next section or done
                local unchecked
                unchecked=$(grep -c '^\- \[ \]' "$TASK_DIR/PROGRESS.md" || true)
                if [ "$unchecked" -eq 0 ]; then
                    next_phase="done"
                else
                    next_phase="exec"
                fi
            fi
            ;;
        done)
            echo "Task is already done. Nothing to advance."
            exit 0
            ;;
        *)
            echo "Error: unknown phase '$current_phase'"
            exit 1
            ;;
    esac

    local now
    now=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    jq \
        --arg from "$current_phase" \
        --arg phase "$next_phase" \
        --arg now "$now" \
    '
        .phase = $phase |
        .phaseIteration = 0 |
        .lastModified = $now |
        .history += [{
            timestamp: $now,
            phase: $from,
            iteration: .phaseIteration,
            engine: .engine,
            model: .model,
            result: ("advance -> " + $phase)
        }]
    ' "$state_file" > "$state_file.tmp" && mv "$state_file.tmp" "$state_file"

    echo "Advanced: $current_phase -> $next_phase"
    commit_state "advance: $current_phase -> $next_phase"
}

# Set phase directly (resets phaseIteration to 0)
set_phase() {
    local target_phase="$1"
    local state_file="$TASK_DIR/state.json"
    if [ ! -f "$state_file" ]; then
        echo "Error: no state.json found in $TASK_DIR"
        exit 1
    fi

    local current_phase
    current_phase=$(jq -r '.phase' "$state_file")
    local now
    now=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    jq \
        --arg from "$current_phase" \
        --arg phase "$target_phase" \
        --arg now "$now" \
    '
        .phase = $phase |
        .phaseIteration = 0 |
        .lastModified = $now |
        .history += [{
            timestamp: $now,
            phase: $from,
            iteration: .phaseIteration,
            engine: .engine,
            model: .model,
            result: ("set-phase -> " + $phase)
        }]
    ' "$state_file" > "$state_file.tmp" && mv "$state_file.tmp" "$state_file"

    echo "Phase set: $current_phase -> $target_phase (phaseIteration reset to 0)"
    commit_state "set-phase: $current_phase -> $target_phase"
}

# Print task status
show_status() {
    local state_file="$TASK_DIR/state.json"
    if [ ! -f "$state_file" ]; then
        echo "No state.json found. Inferred phase: $(infer_phase_from_files)"
        return
    fi

    echo "============================================"
    echo " Task Status: $TASK_NAME"
    echo "============================================"
    echo " Phase:            $(jq -r '.phase' "$state_file")"
    echo " Phase iteration:  $(jq -r '.phaseIteration' "$state_file")"
    echo " Total iterations: $(jq -r '.totalIterations' "$state_file")"
    echo " Status:           $(jq -r '.status' "$state_file")"
    echo " Engine:           $(jq -r '.engine' "$state_file") ($(jq -r '.model' "$state_file"))"
    echo " Created:          $(jq -r '.createdAt' "$state_file")"
    echo " Last modified:    $(jq -r '.lastModified' "$state_file")"
    echo " Branch:           $(jq -r '.metadata.branch' "$state_file")"
    echo "--------------------------------------------"

    # Show files present
    echo " Files:"
    for f in RESEARCH.md PLAN.md PROGRESS.md; do
        if [ -f "$TASK_DIR/$f" ]; then
            echo "   [x] $f"
        else
            echo "   [ ] $f"
        fi
    done

    # Show progress if in exec/done
    if [ -f "$TASK_DIR/PROGRESS.md" ]; then
        local checked unchecked
        checked=$(grep -c '^\- \[x\]' "$TASK_DIR/PROGRESS.md" 2>/dev/null || true)
        unchecked=$(grep -c '^\- \[ \]' "$TASK_DIR/PROGRESS.md" 2>/dev/null || true)
        echo " Progress:         $checked done / $unchecked remaining"
    fi

    echo "--------------------------------------------"
    echo " History (last 10):"
    jq -r '.history | .[-10:] | .[] | "   \(.timestamp) | \(.phase) iter \(.iteration) | \(.engine)/\(.model) | \(.result)"' "$state_file"
    echo "============================================"
}

# Extract the first ## section that has unchecked items
extract_current_section() {
    local progress="$TASK_DIR/PROGRESS.md"
    awk '
    /^## / {
        # If previous section had unchecked items, print it and stop
        if (in_section && has_unchecked) {
            print section
            printf "%s", buf
            found = 1
            exit
        }
        section = $0
        buf = ""
        has_unchecked = 0
        in_section = 1
        next
    }
    in_section {
        buf = buf $0 "\n"
        if ($0 ~ /^- \[ \]/) has_unchecked = 1
    }
    END {
        if (!found && in_section && has_unchecked) {
            print section
            printf "%s", buf
        }
    }
    ' "$progress"
}

# Count progress: "done/remaining"
count_progress() {
    local progress="$TASK_DIR/PROGRESS.md"
    local checked unchecked
    checked=$(grep -c '^\- \[x\]' "$progress" 2>/dev/null || true)
    unchecked=$(grep -c '^\- \[ \]' "$progress" 2>/dev/null || true)
    echo "${checked}/${unchecked}"
}

# Assemble the full prompt for task mode from template files
build_task_prompt() {
    local phase="$1"

    # Inject steering guidance at the top of every phase (if present)
    if [ -f "$TASK_DIR/STEERING.md" ]; then
        local steering_content
        steering_content=$(cat "$TASK_DIR/STEERING.md" | grep -v '^#' | sed '/^$/d' | head -20)
        if [ -n "$steering_content" ]; then
            echo "---"
            echo "# 📌 User Steering (READ FIRST)"
            echo ""
            cat "$TASK_DIR/STEERING.md"
            echo ""
            echo "---"
            echo ""
        fi
    fi

    if [ "$phase" = "research" ]; then
        cat "$SCRIPT_DIR/prompts/task_research.md"
    elif [ "$phase" = "plan" ]; then
        cat "$SCRIPT_DIR/prompts/task_plan.md"
        # Inject research findings so the agent has them in context
        if [ -f "$TASK_DIR/RESEARCH.md" ]; then
            echo ""
            echo "---"
            echo ""
            echo "## Research Findings"
            echo ""
            cat "$TASK_DIR/RESEARCH.md"
        fi
    elif [ "$phase" = "exec" ]; then
        cat "$SCRIPT_DIR/prompts/task_exec.md"
        extract_current_section
        # Inject all checklist templates
        for checklist in "$TEMPLATES"/checklist_*.md; do
            [ -f "$checklist" ] && render_template "$checklist"
        done
    elif [ "$phase" = "review" ]; then
        cat "$SCRIPT_DIR/prompts/task_review.md"
        # Inject current section for review
        echo ""
        echo "---"
        echo ""
        echo "## Current Section (to review)"
        echo ""
        extract_current_section
    fi
}

# ---------------------------------------------------------------
# Handle non-loop modes (status, advance, set-phase) and exit
# ---------------------------------------------------------------

case "$MODE" in
    status)
        show_status
        exit 0
        ;;
    advance)
        ensure_state
        advance_phase
        exit 0
        ;;
    set-phase)
        ensure_state
        set_phase "$PHASE_ARG"
        exit 0
        ;;
esac

# ---------------------------------------------------------------
# Banner (only for task + non-task loop modes)
# ---------------------------------------------------------------

echo "============================================"
echo " Ralph Loop"
echo " Mode: $MODE"
if [ "$MODE" = "task" ]; then
    echo " Task: $TASK_NAME"
    echo " Description: $TASK_PROMPT"
    echo " Task dir: $TASK_DIR"
fi
echo " Engine: $ENGINE$([ "$ENGINE" = "claude" ] && echo " ($MODEL)" || true)"
echo " Branch: $BRANCH"
if [ -n "${PROMPT_FILE:-}" ]; then
    echo " Prompt: $PROMPT_FILE"
fi
echo " No execute: $([ $NO_EXECUTE -eq 1 ] && echo 'yes (research+plan only)' || echo 'no')"
echo " Max iterations: $([ $MAX -gt 0 ] && echo $MAX || echo 'unlimited')"
if [ $ITERATION_DELAY -gt 0 ]; then
    echo " Iteration delay: ${ITERATION_DELAY}s between runs"
fi
echo " Formatter: $(basename "$FORMATTER")"
echo "============================================"

if [ -n "${PROMPT_FILE:-}" ] && [ ! -f "$PROMPT_FILE" ]; then
    echo "Error: $PROMPT_FILE not found"
    exit 1
fi

# ---------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------

# Ensure state.json exists for task mode
if [ "$MODE" = "task" ]; then
    ensure_state
    scaffold_task_files  # Create STEERING.md and other templates
fi

while true; do
    if [ $MAX -gt 0 ] && [ $ITERATION -ge $MAX ]; then
        echo "Reached max iterations: $MAX"
        break
    fi

    ITERATION=$((ITERATION + 1))
    echo -e "\n======== ITERATION $ITERATION $(date '+%H:%M:%S') ========\n"

    if [ "$MODE" = "task" ]; then
        PHASE=$(detect_phase)

        if [ "$PHASE" = "done" ]; then
            STATS=$(count_progress)
            echo "All items checked ($STATS done/remaining). Task complete!"
            echo "See: $TASK_DIR/PROGRESS.md"
            break
        fi

        if [ "$NO_EXECUTE" -eq 1 ] && [ "$PHASE" = "exec" ]; then
            echo "Research and planning complete. Stopping before execution (--no-execute)."
            echo "See: $TASK_DIR/PLAN.md, $TASK_DIR/PROGRESS.md"
            break
        fi

        local_phase_iter=$(jq -r '.phaseIteration' "$TASK_DIR/state.json" 2>/dev/null || echo "0")
        echo " Phase: $PHASE (iteration $local_phase_iter)"
        if [ "$PHASE" = "exec" ] || [ "$PHASE" = "review" ]; then
            SECTION_HEADER=$(extract_current_section | head -1)
            STATS=$(count_progress)
            echo " Section: $SECTION_HEADER"
            echo " Progress: $STATS (done/remaining)"
            if [ "$PHASE" = "review" ]; then
                echo " (Reviewing section for quality/correctness...)"
            fi
        fi
        echo ""

        SEND_PROMPT() { build_task_prompt "$PHASE"; }
    else
        SEND_PROMPT() { cat "$PROMPT_FILE"; }
    fi

    # Execute without timeout
    STATUS=0
    set +e

    # Save prompt to temp file for reliable piping
    TEMP_PROMPT=$(mktemp)
    SEND_PROMPT > "$TEMP_PROMPT"

    if [ "$ENGINE" = "claude" ]; then
        cat "$TEMP_PROMPT" | claude -p \
            --dangerously-skip-permissions \
            --model "$MODEL" \
            --verbose \
            --output-format stream-json \
            | "$FORMATTER" $LOG_FLAG
        STATUS=$?
    else
        cat "$TEMP_PROMPT" | codex exec \
            --json \
            --color never \
            --dangerously-bypass-approvals-and-sandbox \
            - \
            2>&1 \
            | "$FORMATTER" $LOG_FLAG
        STATUS=$?
    fi

    rm -f "$TEMP_PROMPT"
    set -e

    if [ "$STATUS" -eq 42 ]; then
        echo "Detected Codex rate limit. Stopping loop."
        break
    fi
    if [ "$STATUS" -ne 0 ]; then
        echo "Engine run failed with exit code: $STATUS"
        exit "$STATUS"
    fi

    # Update state.json after successful iteration
    if [ "$MODE" = "task" ]; then
        update_state_iteration "success"

        # Auto-transition: exec→review→(exec or done)
        if [ "$PHASE" = "exec" ]; then
            # Always advance exec→review
            jq \
                --arg now "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
            '
                .phase = "review" |
                .lastModified = $now |
                .history += [{
                    timestamp: $now,
                    phase: "exec",
                    iteration: .phaseIteration,
                    engine: .engine,
                    model: .model,
                    result: "auto-advance -> review"
                }]
            ' "$TASK_DIR/state.json" > "$TASK_DIR/state.json.tmp" \
                && mv "$TASK_DIR/state.json.tmp" "$TASK_DIR/state.json"
            echo "  [state] Auto-advanced exec → review"

        elif [ "$PHASE" = "review" ]; then
            # Check if issues found in current section
            local current_section_issues
            current_section_issues=$(extract_current_section | grep -c '⚠️' || true)

            if [ "$current_section_issues" -gt 0 ]; then
                # Issues found — loop back to exec to fix
                jq \
                    --arg now "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
                '
                    .phase = "exec" |
                    .lastModified = $now |
                    .history += [{
                        timestamp: $now,
                        phase: "review",
                        iteration: .phaseIteration,
                        engine: .engine,
                        model: .model,
                        result: "issues found -> loop back to exec"
                    }]
                ' "$TASK_DIR/state.json" > "$TASK_DIR/state.json.tmp" \
                    && mv "$TASK_DIR/state.json.tmp" "$TASK_DIR/state.json"
                echo "  [state] Issues found — looping back to exec"

            else
                # No issues — check if more sections or done
                local unchecked
                unchecked=$(grep -c '^\- \[ \]' "$TASK_DIR/PROGRESS.md" || true)
                if [ "$unchecked" -eq 0 ]; then
                    # All items checked — advance to done
                    jq \
                        --arg now "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
                    '
                        .phase = "done" |
                        .lastModified = $now |
                        .status = "completed" |
                        .history += [{
                            timestamp: $now,
                            phase: "review",
                            iteration: .phaseIteration,
                            engine: .engine,
                            model: .model,
                            result: "no issues found -> advance to done"
                        }]
                    ' "$TASK_DIR/state.json" > "$TASK_DIR/state.json.tmp" \
                        && mv "$TASK_DIR/state.json.tmp" "$TASK_DIR/state.json"
                    echo "  [state] Review clean — auto-advanced review → done"
                else
                    # More items to implement — advance to next exec
                    jq \
                        --arg now "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
                    '
                        .phase = "exec" |
                        .lastModified = $now |
                        .history += [{
                            timestamp: $now,
                            phase: "review",
                            iteration: .phaseIteration,
                            engine: .engine,
                            model: .model,
                            result: "no issues found -> advance to next section"
                        }]
                    ' "$TASK_DIR/state.json" > "$TASK_DIR/state.json.tmp" \
                        && mv "$TASK_DIR/state.json.tmp" "$TASK_DIR/state.json"
                    echo "  [state] Review approved — advancing to next section"
                fi
            fi
        fi
    fi

    # Push if remote exists
    echo "  [git] Pushing to remote (iteration $ITERATION)"
    git push origin "$BRANCH" 2>/dev/null || git push -u origin "$BRANCH" 2>/dev/null || echo "  [git] No remote configured, skipping push"

    # Check for termination signal
    STOP_FILE="${TASK_DIR:-.}/STOP"
    if [ -f "$STOP_FILE" ]; then
        echo ""
        echo "STOP signal detected."
        echo "Reason: $(cat "$STOP_FILE")"
        rm "$STOP_FILE"
        # Update state with blocked status
        if [ "$MODE" = "task" ] && [ -f "$TASK_DIR/state.json" ]; then
            jq \
                --arg now "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
            '
                .status = "blocked" |
                .lastModified = $now
            ' "$TASK_DIR/state.json" > "$TASK_DIR/state.json.tmp" \
                && mv "$TASK_DIR/state.json.tmp" "$TASK_DIR/state.json"
        fi
        break
    fi

    echo -e "\n======== COMPLETED ITERATION $ITERATION ========\n"

    # Add delay between iterations (unless this is the last iteration)
    will_continue=true
    if [ $MAX -gt 0 ] && [ $ITERATION -ge $MAX ]; then
        will_continue=false
    fi

    if [ "$MODE" = "task" ]; then
        next_phase=$(detect_phase)
        if [ "$next_phase" = "done" ]; then
            will_continue=false
        fi
        if [ "$NO_EXECUTE" -eq 1 ] && [ "$next_phase" = "exec" ]; then
            will_continue=false
        fi
    fi

    # No delay between iterations (safety feature removed)
    if $will_continue && [ $ITERATION_DELAY -gt 0 ]; then
        echo -e "  [wait] Sleeping ${ITERATION_DELAY}s before next iteration...\n"
        sleep "$ITERATION_DELAY"
    fi
done

echo "Ralph loop finished after $ITERATION iterations."

# Final push to ensure latest state is uploaded
if [ "$MODE" = "task" ] && [ $ITERATION -gt 0 ]; then
    echo "  [git] Final push to remote..."
    git push origin "$BRANCH" 2>/dev/null || git push -u origin "$BRANCH" 2>/dev/null || echo "  [git] No remote configured, skipping final push"
fi
