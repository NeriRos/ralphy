#!/bin/bash
# Ralph Loop
# Usage: ./loop.sh [mode] [max_iterations] [options]
#
# Modes:
#   task       — run an iteration in the current phase (default)
#   list       — show all incomplete tasks
#   status     — show task state + history
#   advance    — move to next phase (research→plan→exec)
#   set-phase  — jump to any phase (resets phaseIteration to 0)
#
# Options:
#   --name "task-name"       Task name (required for task mode)
#   --prompt "description"   Task description (required for NEW tasks, optional for existing)
#   --prompt-file <path>     Read task description from file (alternative to --prompt)
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
# Examples:
#   # New task (--prompt required)
#   ./loop.sh task --name "dark-mode" --prompt "Add dark/light mode toggle" --claude
#   ./loop.sh task 20 --name "fix-auth" --prompt "Fix auth redirect loop" --claude sonnet
#   ./loop.sh task --name "my-task" --prompt "Do something" --claude --no-execute
#
#   # Resume existing task (all settings loaded from state.json)
#   ./loop.sh task --name "dark-mode"
#   ./loop.sh task --name "env-refactor"
#
#   # Resume with overrides (--claude/--codex overrides saved engine)
#   ./loop.sh task --name "env-refactor" --claude sonnet
#   ./loop.sh task --name "my-task" --codex
#
#   # Task management
#   ./loop.sh list
#   ./loop.sh status --name "my-task"
#   ./loop.sh advance --name "my-task"
#   ./loop.sh set-phase --name "my-task" --phase plan

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

TEMPLATES="$SCRIPT_DIR/templates"
TASKS_DIR="$PROJECT_ROOT/tasks"

# ---------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------

MODE="task"
MAX=0
ENGINE="claude"
MODEL="opus"
ENGINE_SET=0
TASK_NAME=""
TASK_PROMPT=""
PHASE_ARG=""
NO_EXECUTE=0
ITERATION_DELAY=0
PUSH_INTERVAL=1
LOG_FLAG=""

parse_args() {
    local expect_model=0 expect_name=0 expect_prompt=0
    local expect_prompt_file=0 expect_phase=0 expect_delay=0
    local expect_timeout=0 expect_push_interval=0

    for arg in "$@"; do
        if [ "$expect_model" -eq 1 ]; then
            case "$arg" in
                haiku|sonnet|opus)
                    MODEL="$arg"
                    expect_model=0
                    continue
                    ;;
                *) expect_model=0 ;;
            esac
        fi

        if [ "$expect_name" -eq 1 ]; then
            TASK_NAME="$arg"; expect_name=0; continue
        fi
        if [ "$expect_prompt" -eq 1 ]; then
            TASK_PROMPT="$arg"; expect_prompt=0; continue
        fi
        if [ "$expect_prompt_file" -eq 1 ]; then
            if [ ! -f "$arg" ]; then
                echo "Error: prompt file not found: $arg"; exit 1
            fi
            TASK_PROMPT=$(cat "$arg"); expect_prompt_file=0; continue
        fi
        if [ "$expect_phase" -eq 1 ]; then
            PHASE_ARG="$arg"; expect_phase=0; continue
        fi
        if [ "$expect_delay" -eq 1 ]; then
            ITERATION_DELAY="$arg"; expect_delay=0; continue
        fi
        if [ "$expect_timeout" -eq 1 ]; then
            expect_timeout=0; continue  # Deprecated, consume and ignore
        fi
        if [ "$expect_push_interval" -eq 1 ]; then
            PUSH_INTERVAL="$arg"; expect_push_interval=0; continue
        fi

        case "$arg" in
            --claude)
                if [ "$ENGINE_SET" -eq 1 ] && [ "$ENGINE" != "claude" ]; then
                    echo "Error: choose only one engine flag: --claude or --codex"; exit 1
                fi
                ENGINE="claude"; ENGINE_SET=1; expect_model=1
                ;;
            --codex)
                if [ "$ENGINE_SET" -eq 1 ] && [ "$ENGINE" != "codex" ]; then
                    echo "Error: choose only one engine flag: --claude or --codex"; exit 1
                fi
                ENGINE="codex"; ENGINE_SET=1
                ;;
            --name)          expect_name=1 ;;
            --prompt)        expect_prompt=1 ;;
            --prompt-file)   expect_prompt_file=1 ;;
            --phase)         expect_phase=1 ;;
            --no-execute)    NO_EXECUTE=1 ;;
            --delay)         expect_delay=1 ;;
            --timeout)       expect_timeout=1 ;;
            --push-interval) expect_push_interval=1 ;;
            --unlimited)     MAX=0 ;;
            --log)           LOG_FLAG="--log" ;;
            ''|*[!0-9]*)     MODE="$arg" ;;
            *)               MAX="$arg" ;;
        esac
    done
}

# ---------------------------------------------------------------
# Mode validation
# ---------------------------------------------------------------

validate_task_mode() {
    if [ -z "$TASK_NAME" ]; then
        echo "Error: task mode requires --name \"task-name\""
        echo "Usage: ./loop.sh task --name \"my-task\" [--prompt \"Task description\"] --claude"
        exit 1
    fi
    TASK_DIR="$TASKS_DIR/$TASK_NAME"

    if [ -f "$TASK_DIR/state.json" ]; then
        resume_existing_task
    else
        create_new_task
    fi
}

resume_existing_task() {
    echo "  [resume] Found existing task: $TASK_NAME"

    if [ -z "$TASK_PROMPT" ]; then
        TASK_PROMPT=$(jq -r '.prompt' "$TASK_DIR/state.json" 2>/dev/null || echo "")
        if [ -z "$TASK_PROMPT" ]; then
            echo "Error: could not load prompt from existing task state"; exit 1
        fi
    fi

    if [ "$ENGINE_SET" -eq 0 ]; then
        local saved_engine
        saved_engine=$(jq -r '.engine // "claude"' "$TASK_DIR/state.json" 2>/dev/null)
        if [ -n "$saved_engine" ]; then
            ENGINE="$saved_engine"
            echo "  [resume] Using saved engine: $ENGINE"
        fi
    fi

    if [ "$ENGINE" = "claude" ]; then
        local saved_model
        saved_model=$(jq -r '.model // "opus"' "$TASK_DIR/state.json" 2>/dev/null)
        if [ -n "$saved_model" ]; then
            MODEL="$saved_model"
            echo "  [resume] Using saved model: $MODEL"
        fi
    fi

    echo "  [resume] Prompt: $TASK_PROMPT"
}

create_new_task() {
    if [ -z "$TASK_PROMPT" ]; then
        echo "Error: new task requires --prompt \"description\""
        echo "Usage: ./loop.sh task --name \"my-task\" --prompt \"Task description\" --claude"
        exit 1
    fi
    mkdir -p "$TASK_DIR"
    echo "  [new] Creating new task: $TASK_NAME"
}

validate_named_mode() {
    local mode="$1"
    if [ -z "$TASK_NAME" ]; then
        echo "Error: $mode requires --name \"task-name\""; exit 1
    fi
    TASK_DIR="$TASKS_DIR/$TASK_NAME"
    if [ ! -d "$TASK_DIR" ]; then
        echo "Error: task directory $TASK_DIR does not exist"; exit 1
    fi
}

validate_set_phase_mode() {
    validate_named_mode "set-phase"
    if [ -z "$PHASE_ARG" ]; then
        echo "Error: set-phase requires --phase <research|plan|exec|review|done>"; exit 1
    fi
    case "$PHASE_ARG" in
        research|plan|exec|review|done) ;;
        *)
            echo "Error: invalid phase '$PHASE_ARG'. Must be one of: research, plan, exec, review, done"
            exit 1
            ;;
    esac
}

validate_mode() {
    TASK_DIR=""
    case "$MODE" in
        task)              validate_task_mode ;;
        list)              ;; # No validation needed
        status|advance)    validate_named_mode "$MODE" ;;
        set-phase)         validate_set_phase_mode ;;
    esac

    # For non-task loop modes, use the static prompt file
    case "$MODE" in
        task|list|status|advance|set-phase) ;;
        *) PROMPT_FILE="$SCRIPT_DIR/prompts/${MODE}.md" ;;
    esac
}

# ---------------------------------------------------------------
# Template helpers
# ---------------------------------------------------------------

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
        -e "s|{{TASK_DIR}}|$TASK_DIR|g" \
        -e "s|{{DATE}}|$(date '+%Y-%m-%d')|g" \
        -e "s|{{PHASE}}|$phase_val|g" \
        -e "s|{{PHASE_ITERATION}}|$phase_iter|g" \
        "$file" \
    | TASK_PROMPT="$TASK_PROMPT" perl -pe 'BEGIN{$p=$ENV{"TASK_PROMPT"}} s/\{\{TASK_PROMPT\}\}/$p/g'
}

scaffold_task_files() {
    if [ ! -f "$TASK_DIR/STEERING.md" ]; then
        cp "$TEMPLATES/STEERING.md" "$TASK_DIR/STEERING.md"
    fi
}

# ---------------------------------------------------------------
# Progress helpers
# ---------------------------------------------------------------

# Extract the first ## section that has unchecked items
extract_current_section() {
    local progress="$TASK_DIR/PROGRESS.md"
    awk '
    /^## / {
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

count_progress() {
    local progress="$TASK_DIR/PROGRESS.md"
    local checked unchecked
    checked=$(grep -c '^\- \[x\]' "$progress" 2>/dev/null || true)
    unchecked=$(grep -c '^\- \[ \]' "$progress" 2>/dev/null || true)
    echo "${checked}/${unchecked}"
}

# ---------------------------------------------------------------
# State management (state.json)
# ---------------------------------------------------------------

infer_phase_from_files() {
    if [ ! -f "$TASK_DIR/RESEARCH.md" ]; then echo "research"; return; fi
    if [ ! -f "$TASK_DIR/PLAN.md" ] || [ ! -f "$TASK_DIR/PROGRESS.md" ]; then echo "plan"; return; fi
    local unchecked
    unchecked=$(grep -c '^\- \[ \]' "$TASK_DIR/PROGRESS.md" || true)
    if [ "$unchecked" -eq 0 ]; then echo "done"; else echo "exec"; fi
}

# Build the jq template for creating state.json (used by init + migrate)
build_state_json() {
    local phase="$1"
    local prompt="$2"
    local now branch
    now=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
    branch=$(git branch --show-current)

    jq -n \
        --arg name "$TASK_NAME" \
        --arg prompt "$prompt" \
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
        usage: {
            total_cost_usd: 0,
            total_duration_ms: 0,
            total_turns: 0,
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_cache_read_input_tokens: 0,
            total_cache_creation_input_tokens: 0
        },
        history: [],
        metadata: {
            branch: $branch
        }
    }'
}

init_state() {
    build_state_json "research" "$TASK_PROMPT" > "$TASK_DIR/state.json"
}

migrate_state() {
    local phase
    phase=$(infer_phase_from_files)
    build_state_json "$phase" "${TASK_PROMPT:-migrated task}" > "$TASK_DIR/state.json"
    echo "  [migrate] Created state.json for existing task (inferred phase: $phase)"
}

ensure_state() {
    if [ ! -f "$TASK_DIR/state.json" ]; then
        if ls "$TASK_DIR"/*.md >/dev/null 2>&1; then
            migrate_state
        else
            init_state
        fi
    fi
}

detect_phase() {
    if [ -f "$TASK_DIR/state.json" ]; then
        jq -r '.phase' "$TASK_DIR/state.json"
    else
        infer_phase_from_files
    fi
}

# Write a state.json update via jq with atomic rename
update_state_json() {
    local jq_filter="$1"
    shift
    jq "$@" "$jq_filter" "$TASK_DIR/state.json" > "$TASK_DIR/state.json.tmp" \
        && mv "$TASK_DIR/state.json.tmp" "$TASK_DIR/state.json"
}

update_state_iteration() {
    local result="${1:-success}"
    local now
    now=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    update_state_json '
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
            result: $result,
            usage: (.last_iteration_usage // {})
        }] |
        del(.last_iteration_usage)
    ' --arg now "$now" --arg result "$result" --arg engine "$ENGINE" --arg model "$MODEL"
}

# Record a phase transition in state.json history
record_phase_transition() {
    local new_phase="$1"
    local result_msg="$2"
    local now
    now=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    update_state_json '
        .phase = $phase |
        .lastModified = $now |
        .history += [{
            timestamp: $now,
            phase: .phase,
            iteration: .phaseIteration,
            engine: .engine,
            model: .model,
            result: $result
        }]
    ' --arg phase "$new_phase" --arg now "$now" --arg result "$result_msg"
}

commit_state() {
    local msg="${1:-phase transition}"
    local state_file="$TASK_DIR/state.json"
    if [ -f "$state_file" ]; then
        git add "$state_file"
        git commit -m "$msg" -- "$state_file" 2>/dev/null || true
    fi
}

# ---------------------------------------------------------------
# Phase transitions
# ---------------------------------------------------------------

advance_phase() {
    local state_file="$TASK_DIR/state.json"
    if [ ! -f "$state_file" ]; then
        echo "Error: no state.json found in $TASK_DIR"; exit 1
    fi

    local current_phase next_phase
    current_phase=$(jq -r '.phase' "$state_file")

    case "$current_phase" in
        research)
            if [ ! -f "$TASK_DIR/RESEARCH.md" ]; then
                echo "Error: cannot advance from research — RESEARCH.md does not exist yet"; exit 1
            fi
            next_phase="plan"
            ;;
        plan)
            if [ ! -f "$TASK_DIR/PLAN.md" ] || [ ! -f "$TASK_DIR/PROGRESS.md" ]; then
                echo "Error: cannot advance from plan — PLAN.md and PROGRESS.md must both exist"; exit 1
            fi
            local unchecked
            unchecked=$(grep -c '^\- \[ \]' "$TASK_DIR/PROGRESS.md" || true)
            if [ "$unchecked" -eq 0 ]; then
                echo "Error: cannot advance to exec — PROGRESS.md has no unchecked items"; exit 1
            fi
            next_phase="exec"
            ;;
        exec)
            next_phase="review"
            ;;
        review)
            local has_issues
            has_issues=$(extract_current_section | grep -c '⚠️' || true)
            if [ "$has_issues" -gt 0 ]; then
                next_phase="exec"
            else
                local unchecked
                unchecked=$(grep -c '^\- \[ \]' "$TASK_DIR/PROGRESS.md" || true)
                if [ "$unchecked" -eq 0 ]; then next_phase="done"; else next_phase="exec"; fi
            fi
            ;;
        done)
            echo "Task is already done. Nothing to advance."; exit 0
            ;;
        *)
            echo "Error: unknown phase '$current_phase'"; exit 1
            ;;
    esac

    local now
    now=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
    update_state_json '
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
    ' --arg phase "$next_phase" --arg from "$current_phase" --arg now "$now"

    echo "Advanced: $current_phase -> $next_phase"
    commit_state "advance: $current_phase -> $next_phase"
}

set_phase() {
    local target_phase="$1"
    local state_file="$TASK_DIR/state.json"
    if [ ! -f "$state_file" ]; then
        echo "Error: no state.json found in $TASK_DIR"; exit 1
    fi

    local current_phase now
    current_phase=$(jq -r '.phase' "$state_file")
    now=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    update_state_json '
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
    ' --arg phase "$target_phase" --arg from "$current_phase" --arg now "$now"

    echo "Phase set: $current_phase -> $target_phase (phaseIteration reset to 0)"
    commit_state "set-phase: $current_phase -> $target_phase"
}

# ---------------------------------------------------------------
# Display helpers
# ---------------------------------------------------------------

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

    echo " Usage:"
    echo "   Cost:           \$$(jq -r '(.usage.total_cost_usd // 0) * 100 | round / 100' "$state_file")"
    echo "   Time:           $(jq -r '((.usage.total_duration_ms // 0) / 1000 * 10 | round / 10) | tostring + "s"' "$state_file")"
    echo "   Turns:          $(jq -r '.usage.total_turns // 0' "$state_file")"
    echo "   Input tokens:   $(jq -r '.usage.total_input_tokens // 0' "$state_file")"
    echo "   Output tokens:  $(jq -r '.usage.total_output_tokens // 0' "$state_file")"
    echo "   Cached tokens:  $(jq -r '.usage.total_cache_read_input_tokens // 0' "$state_file")"
    echo "--------------------------------------------"

    echo " Files:"
    for f in RESEARCH.md PLAN.md PROGRESS.md; do
        if [ -f "$TASK_DIR/$f" ]; then
            echo "   [x] $f"
        else
            echo "   [ ] $f"
        fi
    done

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

show_list() {
    echo "============================================"
    echo " Incomplete Tasks"
    echo "============================================"
    local found=0
    for state_file in "$TASKS_DIR"/*/state.json; do
        [ -f "$state_file" ] || continue
        local phase name status total modified engine model prompt
        phase=$(jq -r '.phase' "$state_file")
        [ "$phase" = "done" ] && continue
        found=1
        name=$(jq -r '.name' "$state_file")
        status=$(jq -r '.status' "$state_file")
        total=$(jq -r '.totalIterations' "$state_file")
        prompt=$(jq -r '.prompt' "$state_file" | head -c 60)
        # Progress info
        local progress_info=""
        local progress_file="$(dirname "$state_file")/PROGRESS.md"
        if [ -f "$progress_file" ]; then
            local checked unchecked
            checked=$(grep -c '^\- \[x\]' "$progress_file" 2>/dev/null || true)
            unchecked=$(grep -c '^\- \[ \]' "$progress_file" 2>/dev/null || true)
            progress_info=" | progress: $checked done / $unchecked remaining"
        fi
        printf " %-20s  phase: %-8s  status: %-8s  iters: %s%s\n" "$name" "$phase" "$status" "$total" "$progress_info"
        printf "   %s\n" "$prompt"
    done
    if [ "$found" -eq 0 ]; then
        echo " No incomplete tasks found."
    fi
    echo "============================================"
}

show_banner() {
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
}

# ---------------------------------------------------------------
# Prompt building
# ---------------------------------------------------------------

build_task_prompt() {
    local phase="$1"

    # Inject steering guidance at the top of every phase
    if [ -f "$TASK_DIR/STEERING.md" ]; then
        local steering_content
        steering_content=$(grep -v '^#' "$TASK_DIR/STEERING.md" | sed '/^$/d' | head -20)
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

    case "$phase" in
        research)
            cat "$SCRIPT_DIR/prompts/task_research.md"
            ;;
        plan)
            cat "$SCRIPT_DIR/prompts/task_plan.md"
            if [ -f "$TASK_DIR/RESEARCH.md" ]; then
                echo ""
                echo "---"
                echo ""
                echo "## Research Findings"
                echo ""
                cat "$TASK_DIR/RESEARCH.md"
            fi
            ;;
        exec)
            cat "$SCRIPT_DIR/prompts/task_exec.md"
            extract_current_section
            for checklist in "$TEMPLATES"/checklist_*.md; do
                [ -f "$checklist" ] && render_template "$checklist"
            done
            ;;
        review)
            cat "$SCRIPT_DIR/prompts/task_review.md"
            echo ""
            echo "---"
            echo ""
            echo "## Current Section (to review)"
            echo ""
            extract_current_section
            ;;
    esac
}

# ---------------------------------------------------------------
# Engine execution
# ---------------------------------------------------------------

run_engine() {
    local prompt_file="$1"

    if [ "$ENGINE" = "claude" ]; then
        cat "$prompt_file" | claude -p \
            --dangerously-skip-permissions \
            --model "$MODEL" \
            --verbose \
            --output-format stream-json \
            | "$FORMATTER" $LOG_FLAG ${TASK_DIR:+--log-dir "$TASK_DIR"}
    else
        cat "$prompt_file" | codex exec \
            --json \
            --color never \
            --dangerously-bypass-approvals-and-sandbox \
            - \
            2>&1 \
            | "$FORMATTER" $LOG_FLAG ${TASK_DIR:+--log-dir "$TASK_DIR"}
    fi
}

handle_engine_failure() {
    local status="$1"

    case "$status" in
        42)
            echo -e "\n\033[33m\033[1m⚠ Rate limited\033[0m  \033[2mCodex rate limit hit. Stopping loop.\033[0m"
            return 42
            ;;
        130)
            echo -e "\n\033[31m\033[1m✗ Interrupted (exit 130)\033[0m  \033[2mClaude hit usage limits or was cancelled (SIGINT).\033[0m"
            echo -e "  \033[2mThis usually means the conversation exceeded max output tokens or API limits.\033[0m"
            ;;
        137)
            echo -e "\n\033[31m\033[1m✗ Killed (exit 137)\033[0m  \033[2mProcess was killed (SIGKILL / OOM).\033[0m"
            ;;
        1)
            echo -e "\n\033[31m\033[1m✗ Failed (exit 1)\033[0m  \033[2mClaude exited with a general error.\033[0m"
            ;;
        *)
            echo -e "\n\033[31m\033[1m✗ Failed (exit $status)\033[0m  \033[2mEngine exited unexpectedly.\033[0m"
            ;;
    esac

    if [ "$MODE" = "task" ] && [ -f "$TASK_DIR/state.json" ]; then
        update_state_iteration "failed:exit-$status"
    fi
    return "$status"
}

# ---------------------------------------------------------------
# Auto-transition logic (exec ↔ review → done)
# ---------------------------------------------------------------

auto_transition_after_exec() {
    record_phase_transition "review" "auto-advance -> review"
    echo "  [state] Auto-advanced exec → review"
}

auto_transition_after_review() {
    local issues
    issues=$(extract_current_section | grep -c '⚠️' || true)

    if [ "$issues" -gt 0 ]; then
        record_phase_transition "exec" "issues found -> loop back to exec"
        echo "  [state] Issues found — looping back to exec"
        return
    fi

    local unchecked
    unchecked=$(grep -c '^\- \[ \]' "$TASK_DIR/PROGRESS.md" || true)

    if [ "$unchecked" -eq 0 ]; then
        update_state_json '
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
        ' --arg now "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
        echo "  [state] Review clean — auto-advanced review → done"
    else
        record_phase_transition "exec" "no issues found -> advance to next section"
        echo "  [state] Review approved — advancing to next section"
    fi
}

# ---------------------------------------------------------------
# Git helpers
# ---------------------------------------------------------------

git_push() {
    local branch="$1"
    local label="$2"
    echo "  [git] $label"
    git push origin "$branch" 2>/dev/null \
        || git push -u origin "$branch" 2>/dev/null \
        || echo "  [git] No remote configured, skipping push"
}

# ---------------------------------------------------------------
# Stop signal check
# ---------------------------------------------------------------

check_stop_signal() {
    local stop_file="${TASK_DIR:-.}/STOP"
    if [ -f "$stop_file" ]; then
        echo ""
        echo "STOP signal detected."
        echo "Reason: $(cat "$stop_file")"
        rm "$stop_file"
        if [ "$MODE" = "task" ] && [ -f "$TASK_DIR/state.json" ]; then
            update_state_json '
                .status = "blocked" |
                .lastModified = $now
            ' --arg now "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
        fi
        return 0  # Signal was found
    fi
    return 1  # No signal
}

# Check whether the loop should continue after an iteration
should_continue() {
    if [ $MAX -gt 0 ] && [ $ITERATION -ge $MAX ]; then
        return 1
    fi
    if [ "$MODE" = "task" ]; then
        local next_phase
        next_phase=$(detect_phase)
        [ "$next_phase" = "done" ] && return 1
        [ "$NO_EXECUTE" -eq 1 ] && [ "$next_phase" = "exec" ] && return 1
    fi
    return 0
}

# ---------------------------------------------------------------
# Main
# ---------------------------------------------------------------

parse_args "$@"
validate_mode

ITERATION=0
BRANCH=$(git branch --show-current)
FORMATTER="$SCRIPT_DIR/formatters/format-${ENGINE}-stream.sh"

# Handle non-loop modes and exit
case "$MODE" in
    list)      show_list; exit 0 ;;
    status)    show_status; exit 0 ;;
    advance)   ensure_state; advance_phase; exit 0 ;;
    set-phase) ensure_state; set_phase "$PHASE_ARG"; exit 0 ;;
esac

show_banner

if [ -n "${PROMPT_FILE:-}" ] && [ ! -f "$PROMPT_FILE" ]; then
    echo "Error: $PROMPT_FILE not found"; exit 1
fi

# Ensure state.json exists for task mode
if [ "$MODE" = "task" ]; then
    ensure_state
    scaffold_task_files
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
            echo "All items checked ($(count_progress) done/remaining). Task complete!"
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
            echo " Section: $(extract_current_section | head -1)"
            echo " Progress: $(count_progress) (done/remaining)"
            [ "$PHASE" = "review" ] && echo " (Reviewing section for quality/correctness...)"
        fi
        echo ""

        SEND_PROMPT() { build_task_prompt "$PHASE"; }
    else
        SEND_PROMPT() { cat "$PROMPT_FILE"; }
    fi

    # Run engine
    TEMP_PROMPT=$(mktemp)
    SEND_PROMPT > "$TEMP_PROMPT"

    STATUS=0
    set +e
    run_engine "$TEMP_PROMPT"
    STATUS=$?
    rm -f "$TEMP_PROMPT"
    set -e

    if [ "$STATUS" -ne 0 ]; then
        handle_engine_failure "$STATUS"
        exit "$STATUS"
    fi

    # Post-iteration state updates
    if [ "$MODE" = "task" ]; then
        update_state_iteration "success"

        case "$PHASE" in
            exec)   auto_transition_after_exec ;;
            review) auto_transition_after_review ;;
        esac
    fi

    git_push "$BRANCH" "Pushing to remote (iteration $ITERATION)"

    if check_stop_signal; then
        break
    fi

    echo -e "\n======== COMPLETED ITERATION $ITERATION ========\n"

    if should_continue && [ $ITERATION_DELAY -gt 0 ]; then
        echo -e "  [wait] Sleeping ${ITERATION_DELAY}s before next iteration...\n"
        sleep "$ITERATION_DELAY"
    fi
done

echo "Ralph loop finished after $ITERATION iterations."

if [ "$MODE" = "task" ] && [ $ITERATION -gt 0 ]; then
    git_push "$BRANCH" "Final push to remote..."
fi
