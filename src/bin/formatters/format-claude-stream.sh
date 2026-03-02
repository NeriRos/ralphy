#!/bin/bash
# Parses claude --output-format stream-json into readable terminal output
# Usage: claude -p --verbose --output-format stream-json ... | ./format-claude-stream.sh [--verbose] [--log]
#   default:   compact progress — tool names, short summaries, assistant text, result
#   --verbose: full detail — tool inputs, tool result previews, thinking content
#   --log:     save raw JSON output to format-claude-stream.log for debugging

VERBOSE=false
LOG_FILE=""
LOG_DIR=""
EXPECT_LOG_DIR=0
for arg in "$@"; do
    if [ "$EXPECT_LOG_DIR" -eq 1 ]; then
        LOG_DIR="$arg"
        EXPECT_LOG_DIR=0
        continue
    fi
    [ "$arg" = "--verbose" ] || [ "$arg" = "-v" ] && VERBOSE=true
    [ "$arg" = "--log" ] && LOG_FILE="1"
    [ "$arg" = "--log-dir" ] && EXPECT_LOG_DIR=1
done
if [ -n "$LOG_FILE" ]; then
    if [ -n "$LOG_DIR" ]; then
        LOG_FILE="$LOG_DIR/stream.log"
    else
        LOG_FILE="format-claude-stream.log"
    fi
    > "$LOG_FILE"  # Clear existing log
fi

BOLD='\033[1m'
DIM='\033[2m'
ITALIC='\033[3m'
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
MAGENTA='\033[35m'
RED='\033[31m'
BLUE='\033[34m'
RESET='\033[0m'
GRAY='\033[90m'

TURN=0
TOOL_COUNT=0
GOT_RESULT=false

while IFS= read -r line; do
    [ -z "$line" ] && continue

    # Log raw output if --log flag was set
    [ -n "$LOG_FILE" ] && echo "$line" >> "$LOG_FILE"

    type=$(echo "$line" | jq -r '.type // empty' 2>/dev/null)
    [ -z "$type" ] && continue

    case "$type" in
        system)
            subtype=$(echo "$line" | jq -r '.subtype // ""')
            case "$subtype" in
                init)
                    model=$(echo "$line" | jq -r '.model // "unknown"')
                    sid=$(echo "$line" | jq -r '.session_id // ""' | cut -c1-8)
                    if [ "$model" = "unknown" ]; then
                        if $VERBOSE; then
                            echo -e "${RED}${BOLD}⚠ FAILED TO PARSE MODEL${RESET} ${DIM}(${sid}…)${RESET}"
                            echo -e "${DIM}  Check log file for raw JSON output. Run with --log to capture full output.${RESET}"
                        else
                            echo -e "${RED}✗${RESET} ${BOLD}UNKNOWN${RESET} ${DIM}(${sid}…) - see --log${RESET}"
                        fi
                    else
                        if $VERBOSE; then
                            ver=$(echo "$line" | jq -r '.claude_code_version // ""')
                            ntools=$(echo "$line" | jq -r '.tools | length')
                            echo -e "${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
                            echo -e "${DIM}  model: ${RESET}${BOLD}${model}${RESET}  ${DIM}session: ${sid}…  v${ver}  tools: ${ntools}${RESET}"
                            echo -e "${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
                        else
                            echo -e "${GRAY}──${RESET} ${BOLD}${model}${RESET} ${GRAY}(${sid}…)${RESET}"
                        fi
                    fi
                    ;;
                task_started)
                    if $VERBOSE; then
                        desc=$(echo "$line" | jq -r '.description // ""')
                        [ -n "$desc" ] && echo -e "  ${DIM}⊳ agent: ${desc}${RESET}"
                    fi
                    ;;
            esac
            ;;

        assistant)
            TURN=$((TURN + 1))
            content=$(echo "$line" | jq -c '.message.content[]' 2>/dev/null)
            while IFS= read -r block; do
                [ -z "$block" ] && continue
                btype=$(echo "$block" | jq -r '.type // empty')

                case "$btype" in
                    text)
                        text=$(echo "$block" | jq -r '.text // empty')
                        [ -n "$text" ] && echo -e "\n${BOLD}${text}${RESET}"
                        ;;
                    tool_use)
                        TOOL_COUNT=$((TOOL_COUNT + 1))
                        name=$(echo "$block" | jq -r '.name // "?"')
                        input_summary=$(echo "$block" | jq -r '
                            .input |
                            if .file_path then "📄 " + (.file_path | split("/") | .[-1])
                            elif .command then "$ " + (.command | split("\n") | .[0])
                            elif .pattern then "🔍 " + .pattern + (if .path then " in " + (.path | split("/") | .[-1]) else "" end)
                            elif .query then "🔍 " + .query
                            elif .url then "🌐 " + .url
                            elif .prompt then "💬 " + (.prompt | split("\n") | .[0])
                            elif .old_string then "✏️  edit"
                            elif .content then "📝 write"
                            else ""
                            end
                        ' 2>/dev/null)
                        if $VERBOSE; then
                            echo -e "\n  ${CYAN}${BOLD}▶ ${name}${RESET}"
                            [ -n "$input_summary" ] && echo -e "    ${DIM}${input_summary}${RESET}"
                        else
                            # Compact: tool + summary, each on own line
                            printf "  ${CYAN}▶${RESET} ${CYAN}${name}${RESET}"
                            [ -n "$input_summary" ] && printf " ${DIM}${input_summary}${RESET}"
                            printf "\n"
                        fi
                        ;;
                    thinking)
                        if $VERBOSE; then
                            thinking=$(echo "$block" | jq -r '.thinking // empty')
                            if [ -n "$thinking" ]; then
                                preview=$(echo "$thinking" | head -3)
                                total=$(echo "$thinking" | wc -l | tr -d ' ')
                                echo -e "\n  ${GRAY}${ITALIC}💭 thinking${RESET}"
                                echo "$preview" | while IFS= read -r tl; do
                                    echo -e "  ${GRAY}${tl}${RESET}"
                                done
                                [ "$total" -gt 3 ] && echo -e "  ${GRAY}  … ($((total - 3)) more lines)${RESET}"
                            fi
                        else
                            echo -ne "  ${GRAY}💭${RESET}"
                        fi
                        ;;
                esac
            done <<< "$content"
            ;;

        user)
            # Tool results
            if $VERBOSE; then
                content=$(echo "$line" | jq -c '.message.content[]' 2>/dev/null)
                while IFS= read -r block; do
                    [ -z "$block" ] && continue
                    btype=$(echo "$block" | jq -r '.type // empty')
                    if [ "$btype" = "tool_result" ]; then
                        result_text=$(echo "$block" | jq -r '
                            .content |
                            if type == "string" then .
                            elif type == "array" then
                                [.[] | select(.type == "text") | .text] | join("\n")
                            else ""
                            end
                        ' 2>/dev/null)
                        if [ -n "$result_text" ]; then
                            total=$(echo "$result_text" | wc -l | tr -d ' ')
                            preview=$(echo "$result_text" | head -6)
                            echo -e "    ${DIM}${preview}${RESET}"
                            [ "$total" -gt 6 ] && echo -e "    ${DIM}… ($((total - 6)) more lines)${RESET}"
                        fi
                    fi
                done <<< "$content"
            else
                # Compact: checkmark on its own, spaced right
                echo -e " ${GREEN}✓${RESET}"
            fi
            ;;

        result)
            GOT_RESULT=true
            info=$(echo "$line" | jq -r '
                "cost=$" + ((.total_cost_usd // 0) * 100 | round / 100 | tostring) +
                "  time=" + (((.duration_ms // 0) / 1000 * 10 | round / 10) | tostring) + "s" +
                "  turns=" + ((.num_turns // 0) | tostring) +
                "  in=" + ((.usage.input_tokens // 0) | tostring) +
                "  out=" + ((.usage.output_tokens // 0) | tostring) +
                "  cached=" + ((.usage.cache_read_input_tokens // 0) | tostring)
            ' 2>/dev/null)
            subtype=$(echo "$line" | jq -r '.subtype // "unknown"')
            if [ "$subtype" = "error" ]; then
                errmsg=$(echo "$line" | jq -r '.result // "unknown error"')
                echo -e "\n${RED}${BOLD}✗ Error${RESET} ${RED}${errmsg}${RESET}"
            else
                if $VERBOSE; then
                    echo -e "\n${GREEN}${BOLD}✓ Done${RESET}  ${DIM}${info}${RESET}"
                    echo -e "${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
                else
                    echo -e "\n${GREEN}✓ done${RESET}  ${DIM}${info}${RESET}"
                fi
            fi
            # Write iteration stats to file for loop.sh to pick up
            if [ -n "$LOG_DIR" ]; then
                echo "$line" | jq '{
                    cost_usd: (.total_cost_usd // 0),
                    duration_ms: (.duration_ms // 0),
                    num_turns: (.num_turns // 0),
                    input_tokens: (.usage.input_tokens // 0),
                    output_tokens: (.usage.output_tokens // 0),
                    cache_read_input_tokens: (.usage.cache_read_input_tokens // 0),
                    cache_creation_input_tokens: (.usage.cache_creation_input_tokens // 0)
                }' > "$LOG_DIR/.iteration_stats.json" 2>/dev/null
            fi
            ;;
    esac
done

# If stream ended without a result event, Claude was interrupted (limits, Ctrl+C, crash)
if ! $GOT_RESULT; then
    echo ""
    echo -e "${RED}${BOLD}✗ Stream interrupted${RESET}  ${DIM}(no result received — Claude may have hit usage limits or been interrupted)${RESET}"
    if $VERBOSE; then
        echo -e "${DIM}  turns=$TURN  tools=$TOOL_COUNT${RESET}"
        echo -e "${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    fi
fi
