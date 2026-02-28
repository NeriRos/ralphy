#!/bin/bash
# Parses `codex exec --json` JSONL into readable terminal output
# Usage: codex exec --json ... | ./ralph/format-codex-stream.sh [--verbose]
#   default: compact progress + assistant text + completion status
#   --verbose: also prints unknown events and non-JSON stderr/stdout lines

VERBOSE=false
for arg in "$@"; do
    [ "$arg" = "--verbose" ] || [ "$arg" = "-v" ] && VERBOSE=true
done

BOLD='\033[1m'
DIM='\033[2m'
CYAN='\033[36m'
GREEN='\033[32m'
RED='\033[31m'
GRAY='\033[90m'
RESET='\033[0m'

PRINTING_TEXT=false
RATE_LIMITED=false
PENDING_TOOLS=0

is_tool_type() {
    case "$1" in
        mcp_tool_call|tool_call|function_call|computer_call|command_execution)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

extract_tool_name() {
    local line="$1"
    echo "$line" | jq -r '
        (
            [
                .name?,
                .tool_name?,
                .tool?.name?,
                .tool?,
                .item?.name?,
                .item?.tool_name?,
                .item?.tool?.name?,
                .item?.tool?,
                .item?.raw_item?.name?,
                .item?.raw_item?.tool_name?,
                .item?.raw_item?.recipient_name?,
                .item?.raw_item?.tool?.name?,
                .item?.raw_item?.tool?,
                .item?.call?.name?,
                .item?.raw_item?.call?.name?,
                .item?.function?.name?,
                .item?.raw_item?.function?.name?
            ]
            | map(select(type == "string" and length > 0))
            | .[0]
        ) as $name |
        (.item?.server? // .server? // "") as $server |
        if ($server | type == "string" and length > 0) and ($name | type == "string" and length > 0) then
            $server + "/" + $name
        else
            ($name // empty)
        end
    ' 2>/dev/null
}

is_important_nonjson() {
    local line="$1"
    echo "$line" | grep -Eiq 'panicked at|thread .+ panicked|(^|[[:space:]])error([[:space:]:]|$)|failed|exception|traceback|fatal'
}

print_text_chunk() {
    local text="$1"
    [ -z "$text" ] && return 0
    if ! $PRINTING_TEXT; then
        echo -ne "\n${BOLD}"
        PRINTING_TEXT=true
    fi
    printf "%s" "$text"
}

shorten_inline() {
    local text="$1"
    local max="${2:-140}"
    text=$(printf "%s" "$text" | tr '\n' ' ' | tr '\r' ' ' | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//')
    if [ "${#text}" -gt "$max" ]; then
        printf "%s..." "${text:0:max}"
    else
        printf "%s" "$text"
    fi
}

extract_tool_input_summary() {
    local line="$1"
    local raw
    raw=$(echo "$line" | jq -r '
        (
            .item?.command? //
            .command? //
            .arguments? // .input? //
            .item?.arguments? // .item?.input? //
            .item?.raw_item?.arguments? // .item?.raw_item?.input? //
            .item?.call?.arguments? // .item?.raw_item?.call?.arguments? //
            .item?.function?.arguments? // .item?.raw_item?.function?.arguments? //
            empty
        ) as $v |
        if ($v | type) == "string" then $v
        elif ($v | type) == "null" then ""
        else ($v | tojson)
        end
    ' 2>/dev/null)
    [ -z "$raw" ] && return 0
    shorten_inline "$raw" 160
}

extract_tool_result_summary() {
    local line="$1"
    local raw
    raw=$(echo "$line" | jq -r '
        (
            .item?.error?.message? //
            .error?.message? //
            .item?.aggregated_output? //
            .aggregated_output? //
            .output? // .result? // .content? //
            .item?.output? // .item?.result? // .item?.content? //
            .item?.raw_item?.output? // .item?.raw_item?.result? // .item?.raw_item?.content? //
            .item?.call?.output? // .item?.raw_item?.call?.output? //
            empty
        ) as $v |
        if ($v | type) == "string" then $v
        elif ($v | type) == "null" then ""
        else ($v | tojson)
        end
    ' 2>/dev/null)
    [ -z "$raw" ] && return 0
    shorten_inline "$raw" 160
}

extract_thinking_text() {
    local line="$1"
    echo "$line" | jq -r '
        .delta // .text // .summary // .reasoning // .message //
        .item.delta // .item.text // .item.summary // .item.reasoning //
        .item.raw_item.delta // .item.raw_item.text // .item.raw_item.summary // .item.raw_item.reasoning //
        empty
    ' 2>/dev/null
}

extract_message_text() {
    local line="$1"
    echo "$line" | jq -r '
        if (.item?.type? // .item?.raw_item?.type? // "") == "agent_message" then
            (.item?.text? // "")
        elif (.item?.type? // .item?.raw_item?.type? // "") == "message" then
            [
                (.item?.content // .item?.raw_item?.content // [])[]? |
                select(
                    (.type // "") == "output_text" or
                    (.type // "") == "text" or
                    (.type // "") == "summary_text"
                ) |
                (.text // .value // "")
            ] | join("")
        else
            ""
        end
    ' 2>/dev/null
}

while IFS= read -r line; do
    [ -z "$line" ] && continue

    if ! echo "$line" | jq -e . >/dev/null 2>&1; then
        if echo "$line" | grep -qi "hit your limit"; then
            RATE_LIMITED=true
            echo -e "\n${RED}${BOLD}✗ Rate limit reached${RESET} ${RED}${line}${RESET}"
        elif is_important_nonjson "$line"; then
            echo -e "${RED}${BOLD}stderr:${RESET} ${RED}${line}${RESET}"
        elif $VERBOSE; then
            echo -e "${GRAY}${line}${RESET}"
        fi
        continue
    fi

    type=$(echo "$line" | jq -r '.type // empty')
    [ -z "$type" ] && continue

    case "$type" in
        thread.started)
            tid=$(echo "$line" | jq -r '.thread_id // ""' | cut -c1-8)
            echo -e "${GRAY}──${RESET} ${BOLD}codex${RESET} ${GRAY}(${tid}...)${RESET}"
            ;;

        turn.started)
            echo -e "\n${BOLD}▶ turn started${RESET}"
            ;;

        turn.completed)
            usage=$(echo "$line" | jq -r '
                .usage as $u |
                if $u then
                    "in=" + (($u.input_tokens // 0) | tostring) +
                    "  out=" + (($u.output_tokens // 0) | tostring)
                else ""
                end
            ' 2>/dev/null)
            $PRINTING_TEXT && echo
            PRINTING_TEXT=false
            if [ -n "$usage" ]; then
                echo -e "\n${GREEN}✓ done${RESET}  ${DIM}${usage}${RESET}"
            else
                echo -e "\n${GREEN}✓ done${RESET}"
            fi
            ;;

        turn.failed)
            err=$(echo "$line" | jq -r '.error.message // .message // "unknown error"')
            $PRINTING_TEXT && echo
            PRINTING_TEXT=false
            echo -e "\n${RED}${BOLD}✗ Error${RESET} ${RED}${err}${RESET}"
            ;;

        error)
            msg=$(echo "$line" | jq -r '.message // "unknown error"')
            if echo "$msg" | grep -qi "hit your limit"; then
                RATE_LIMITED=true
                echo -e "${RED}${BOLD}✗ Rate limit reached${RESET} ${RED}${msg}${RESET}"
            else
                echo -e "${RED}error:${RESET} ${msg}"
            fi
            ;;

        response.output_text.delta|assistant.message.delta|message.delta|output_text.delta)
            delta=$(echo "$line" | jq -r '.delta // .text // .message // empty')
            print_text_chunk "$delta"
            ;;

        response.output_text.done|assistant.message.completed|message.completed|output_text.done)
            done_text=$(echo "$line" | jq -r '.text // empty')
            print_text_chunk "$done_text"
            if $PRINTING_TEXT; then
                echo -e "${RESET}"
                PRINTING_TEXT=false
            fi
            ;;

        response.reasoning.delta|reasoning.delta|thinking.delta|assistant.thinking.delta|response.reasoning_summary.delta|response.reasoning_summary_text.delta)
            think=$(extract_thinking_text "$line")
            if [ -n "$think" ]; then
                $PRINTING_TEXT && echo
                PRINTING_TEXT=false
                echo -e "  ${GRAY}thinking:${RESET} ${DIM}${think}${RESET}"
            fi
            ;;

        tool.started|tool.call.started|item.started)
            name=$(extract_tool_name "$line")
            input_summary=$(extract_tool_input_summary "$line")
            item_type=$(echo "$line" | jq -r '.item?.type? // .item?.raw_item?.type? // empty' 2>/dev/null)
            if [ -z "$name" ] && [ "$item_type" = "command_execution" ]; then
                name="shell"
            fi
            if [ -n "$name" ]; then
                if [ -n "$input_summary" ]; then
                    echo -e "  ${CYAN}▶${RESET} ${CYAN}${name}${RESET} ${DIM}${input_summary}${RESET}"
                else
                    echo -e "  ${CYAN}▶${RESET} ${CYAN}${name}${RESET}"
                fi
                PENDING_TOOLS=$((PENDING_TOOLS + 1))
            fi
            ;;

        response.output_item.added|item.added)
            message_text=$(extract_message_text "$line")
            print_text_chunk "$message_text"
            if [ -n "$message_text" ] && $PRINTING_TEXT; then
                echo -e "${RESET}"
                PRINTING_TEXT=false
            fi

            item_type=$(echo "$line" | jq -r '.item.type // .item.raw_item.type // empty')
            name=$(extract_tool_name "$line")
            input_summary=$(extract_tool_input_summary "$line")
            if [ -n "$name" ] || is_tool_type "$item_type"; then
                [ -z "$name" ] && name="${item_type:-tool_call}"
                if [ -n "$input_summary" ]; then
                    echo -e "  ${CYAN}▶${RESET} ${CYAN}${name}${RESET} ${DIM}${input_summary}${RESET}"
                else
                    echo -e "  ${CYAN}▶${RESET} ${CYAN}${name}${RESET}"
                fi
                PENDING_TOOLS=$((PENDING_TOOLS + 1))
            fi
            ;;

        tool.completed|tool.call.completed|item.completed|response.output_item.done)
            message_text=$(extract_message_text "$line")
            print_text_chunk "$message_text"
            if [ -n "$message_text" ] && $PRINTING_TEXT; then
                echo -e "${RESET}"
                PRINTING_TEXT=false
            fi

            item_type=$(echo "$line" | jq -r '.item?.type? // .item?.raw_item?.type? // ""' 2>/dev/null)
            if [ "$item_type" = "reasoning" ]; then
                think=$(extract_thinking_text "$line")
                if [ -n "$think" ]; then
                    $PRINTING_TEXT && echo
                    PRINTING_TEXT=false
                    echo -e "  ${GRAY}thinking:${RESET} ${DIM}${think}${RESET}"
                fi
            fi

            tool_name=$(extract_tool_name "$line")
            tool_type="$item_type"
            if [ -z "$tool_name" ] && [ "$tool_type" = "command_execution" ]; then
                tool_name="shell"
            fi
            result_summary=$(extract_tool_result_summary "$line")
            is_tool=$(echo "$line" | jq -r '
                (
                    .name? // .tool_name? //
                    .tool?.name? // .tool? //
                    .item?.name? // .item?.tool_name? //
                    .item?.tool?.name? // .item?.tool? //
                    .item?.raw_item?.name? // .item?.raw_item?.tool_name? //
                    .item?.raw_item?.recipient_name? //
                    .item?.call?.name? // .item?.raw_item?.call?.name? //
                    .item?.function?.name? // .item?.raw_item?.function?.name? //
                    .item?.raw_item?.tool?.name? // .item?.raw_item?.tool? //
                    ""
                ) as $n |
                (
                    .item?.type? // .item?.raw_item?.type? // ""
                ) as $t |
                if ($n | length) > 0 then "yes"
                elif ($t == "mcp_tool_call" or $t == "tool_call" or $t == "function_call" or $t == "computer_call" or $t == "command_execution") then "yes"
                else "no"
                end
            ' 2>/dev/null)
            if [ "$is_tool" = "yes" ]; then
                if [ -n "$tool_name" ]; then
                    if [ -n "$result_summary" ]; then
                        echo -e " ${GREEN}✓${RESET} ${DIM}${tool_name}${RESET} ${DIM}→ $(shorten_inline "$result_summary" 140)${RESET}"
                    else
                        echo -e " ${GREEN}✓${RESET} ${DIM}${tool_name}${RESET}"
                    fi
                elif is_tool_type "$tool_type"; then
                    if $VERBOSE; then
                        if [ -n "$result_summary" ]; then
                            echo -e " ${GREEN}✓${RESET} ${DIM}${tool_type}${RESET} ${DIM}→ $(shorten_inline "$result_summary" 140)${RESET}"
                        else
                            echo -e " ${GREEN}✓${RESET} ${DIM}${tool_type}${RESET}"
                        fi
                    elif [ "$PENDING_TOOLS" -gt 0 ]; then
                        echo -e " ${GREEN}✓${RESET}"
                    fi
                else
                    echo -e " ${GREEN}✓${RESET}"
                fi
                if [ "$PENDING_TOOLS" -gt 0 ]; then
                    PENDING_TOOLS=$((PENDING_TOOLS - 1))
                fi
            fi
            ;;

        response.completed)
            final_text=$(echo "$line" | jq -r '
                [
                    (.response.output // [])[]? |
                    select((.type // "") == "message") |
                    (.content // [])[]? |
                    select((.type // "") == "output_text" or (.type // "") == "text") |
                    (.text // "")
                ] | join("")
            ')
            print_text_chunk "$final_text"
            if [ -n "$final_text" ] && $PRINTING_TEXT; then
                echo -e "${RESET}"
                PRINTING_TEXT=false
            fi
            ;;

        *)
            if $VERBOSE; then
                preview=$(echo "$line" | jq -c '.' | cut -c1-220)
                echo -e "${DIM}${type}: ${preview}${RESET}"
            fi
            ;;
    esac
done

if $PRINTING_TEXT; then
    echo -e "${RESET}"
fi

if $RATE_LIMITED; then
    exit 42
fi
