#!/bin/bash
# Smoke tests for stream_mode parameter
# Usage: ./scripts/smoke-stream-mode.sh [API_KEY]
#
# Prerequisites: API running (make dev)
# Outputs: ./logs/smoke-stream-mode-<timestamp>/
#
# Supports both sync mode (DISTRIBUTED_WORKERS=false, returns SSE directly)
# and distributed mode (DISTRIBUTED_WORKERS=true, returns thread_id then poll).

set -euo pipefail

API_URL="${API_URL:-http://localhost:8000}"
API_KEY="${1:-}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_DIR="./logs/smoke-stream-mode-${TIMESTAMP}"
MODEL="${MODEL:-openai:gpt-4.1-mini}"
PROMPT="Say exactly: hello world"
PASS=0
FAIL=0
TOTAL=0

mkdir -p "$LOG_DIR"

# Stream from distributed thread endpoint until [DONE] or timeout
stream_until_done() {
    local url="$1"
    local output_file="$2"

    local tmp_file
    tmp_file=$(mktemp)
    curl -s -N "$url" ${API_KEY:+-H "x-api-key: $API_KEY"} > "$tmp_file" 2>&1 &
    local curl_pid=$!

    local timeout=60
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        if grep -q "\[DONE\]" "$tmp_file" 2>/dev/null; then
            kill $curl_pid 2>/dev/null || true
            wait $curl_pid 2>/dev/null || true
            cat "$tmp_file" > "$output_file"
            rm -f "$tmp_file"
            return 0
        fi
        sleep 0.5
        elapsed=$((elapsed + 1))
    done

    # Timeout — save what we have
    kill $curl_pid 2>/dev/null || true
    wait $curl_pid 2>/dev/null || true
    cat "$tmp_file" > "$output_file"
    rm -f "$tmp_file"
    echo "  WARNING: stream timed out after ${timeout}s"
    return 0
}

# Helper: POST /llm/stream, handle sync or distributed, save output, validate
smoke_test() {
    local name="$1"
    local payload="$2"
    local expect_status="${3:-200}"  # 200 for sync SSE, 202 for distributed, 422 for error
    local grep_pattern="${4:-}"

    TOTAL=$((TOTAL + 1))
    echo "$payload" | python3 -m json.tool > "$LOG_DIR/${name}_request.json" 2>/dev/null \
        || echo "$payload" > "$LOG_DIR/${name}_request.json"

    HTTP_CODE=$(curl -s -o "$LOG_DIR/${name}_response.txt" -w "%{http_code}" \
        -X POST "$API_URL/api/llm/stream" \
        -H "Content-Type: application/json" \
        ${API_KEY:+-H "x-api-key: $API_KEY"} \
        -N --max-time 60 \
        -d "$payload")

    # Distributed mode: 202 means follow up with stream poll
    if [ "$HTTP_CODE" = "202" ] && [ "$expect_status" != "422" ]; then
        local thread_id run_id
        thread_id=$(python3 -c "import json,sys; d=json.load(open('$LOG_DIR/${name}_response.txt')); print(d['thread_id'])" 2>/dev/null || echo "")
        run_id=$(python3 -c "import json,sys; d=json.load(open('$LOG_DIR/${name}_response.txt')); print(d.get('run_id',''))" 2>/dev/null || echo "")

        if [ -z "$thread_id" ]; then
            echo "[$name] HTTP 202 but no thread_id — FAIL"
            FAIL=$((FAIL + 1))
            return 0
        fi

        echo "[$name] HTTP 202 (distributed) → streaming thread $thread_id ..."
        sleep 2  # wait for worker to start

        local stream_url="$API_URL/api/threads/$thread_id/stream"
        [ -n "$run_id" ] && stream_url="${stream_url}?run_id=${run_id}"

        stream_until_done "$stream_url" "$LOG_DIR/${name}_stream.txt"

        # Validate against the stream output
        if [ -n "$grep_pattern" ]; then
            if grep -q "$grep_pattern" "$LOG_DIR/${name}_stream.txt"; then
                echo "  PASS"
                PASS=$((PASS + 1))
            else
                echo "  FAIL: pattern '$grep_pattern' not found in stream"
                FAIL=$((FAIL + 1))
            fi
        else
            echo "  PASS"
            PASS=$((PASS + 1))
        fi
        return 0
    fi

    # Sync mode or error responses
    echo "[$name] HTTP $HTTP_CODE (expected $expect_status)"

    if [ "$HTTP_CODE" != "$expect_status" ]; then
        echo "  FAIL: unexpected status code"
        FAIL=$((FAIL + 1))
        return 0
    fi

    if [ -n "$grep_pattern" ]; then
        if grep -q "$grep_pattern" "$LOG_DIR/${name}_response.txt"; then
            echo "  PASS"
            PASS=$((PASS + 1))
        else
            echo "  FAIL: pattern '$grep_pattern' not found in response"
            FAIL=$((FAIL + 1))
        fi
    else
        echo "  PASS"
        PASS=$((PASS + 1))
    fi
    return 0
}

echo "=============================================="
echo "stream_mode Smoke Tests"
echo "=============================================="
echo "API: $API_URL | Model: $MODEL"
echo "Logs: $LOG_DIR"
echo ""

# --- Tests ---

# 1. Default (omitted) — should produce messages events
smoke_test "01_default_omitted" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}]},\"model\":\"$MODEL\"}" \
  200 "messages"

# 2. Default (explicit) — same as test 1
smoke_test "02_default_explicit" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}]},\"model\":\"$MODEL\",\"stream_mode\":[\"messages\",\"values\"]}" \
  200 "messages"

# 3. Messages only
smoke_test "03_messages_only" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}]},\"model\":\"$MODEL\",\"stream_mode\":[\"messages\"]}" \
  200 "messages"

# 4. All three modes (messages + values + updates)
smoke_test "04_all_three" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}]},\"model\":\"$MODEL\",\"stream_mode\":[\"messages\",\"values\",\"updates\"]}" \
  200 "messages"

# 5. Updates only
smoke_test "05_updates_only" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}]},\"model\":\"$MODEL\",\"stream_mode\":[\"updates\"]}" \
  200 "updates"

# 6. Single string coercion (string → list)
smoke_test "06_single_string" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}]},\"model\":\"$MODEL\",\"stream_mode\":\"messages\"}" \
  200 "messages"

# 7. Invalid mode → 422
smoke_test "07_invalid_mode" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}]},\"model\":\"$MODEL\",\"stream_mode\":[\"messages\",\"bogus\"]}" \
  422 "Invalid stream mode"

# 8. Empty list → falls back to default
smoke_test "08_empty_list" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}]},\"model\":\"$MODEL\",\"stream_mode\":[]}" \
  200 "messages"

echo ""
echo "--- Tool-calling tests (read AGENTS.md + append date) ---"
echo ""

# File content for tool tests — excerpt of AGENTS.md passed via input.files
AGENTS_MD_CONTENT="# AGENTS.md\n\nThis file provides guidance to AI agents.\n\n## Project Overview\n\nbackend: python, uv, fastapi, langchain\nfrontend: typescript, vite, react, shadcn\n\n## Code Style\n\n- Use Python 3.12+ features\n- Follow PEP 8 conventions\n- Type hints required\n"

TOOL_PROMPT="Use the python_sandbox tool to execute this code exactly:\\n\\nimport datetime\\nagents_md = '''# AGENTS.md\\nThis file provides guidance to AI agents.\\n## Project Overview\\nbackend: python, uv, fastapi, langchain\\nfrontend: typescript, vite, react, shadcn\\n## Code Style\\n- Use Python 3.12+ features\\n- Follow PEP 8 conventions\\n- Type hints required\\n'''\\nresult = agents_md.rstrip() + '\\\\n\\\\nLast updated: ' + datetime.date.today().isoformat() + '\\\\n'\\nprint(result)"
TOOL_SYSTEM="You MUST call the python_sandbox tool with the code provided by the user. Do NOT answer directly. Do NOT modify the code. Just call python_sandbox with it."

# 9. Tool call — messages mode: tool invocation + ToolMessage result in SSE
smoke_test "09_tool_file_messages" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$TOOL_PROMPT\"}]},\"model\":\"$MODEL\",\"system\":\"$TOOL_SYSTEM\",\"stream_mode\":[\"messages\"]}" \
  200 "\"type\":\"tool\""

# 10. Tool call — updates mode: graph node execution (model → tools → model)
smoke_test "10_tool_file_updates" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$TOOL_PROMPT\"}]},\"model\":\"$MODEL\",\"system\":\"$TOOL_SYSTEM\",\"stream_mode\":[\"updates\"]}" \
  200 "\"tools\""

# 11. Tool call — all three modes: messages + values + updates together
smoke_test "11_tool_file_all_modes" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$TOOL_PROMPT\"}]},\"model\":\"$MODEL\",\"system\":\"$TOOL_SYSTEM\",\"stream_mode\":[\"messages\",\"values\",\"updates\"]}" \
  200 "\"type\":\"tool\""

# --- Verify tool execution in logs ---
echo ""
echo "--- Verifying tool execution in logs ---"
echo ""

TOOL_VERIFY_PASS=true
for test_name in 09_tool_file_messages 10_tool_file_updates 11_tool_file_all_modes; do
    RESPONSE_FILE="$LOG_DIR/${test_name}_response.txt"
    STREAM_FILE="$LOG_DIR/${test_name}_stream.txt"
    CHECK_FILE="$RESPONSE_FILE"
    [ -f "$STREAM_FILE" ] && CHECK_FILE="$STREAM_FILE"

    tool_exec=$(grep -c '"type":"tool"' "$CHECK_FILE" 2>/dev/null) || tool_exec=0
    tools_node=$(grep -c '"tools"' "$CHECK_FILE" 2>/dev/null) || tools_node=0
    has_date=$(grep -c "Last updated\|datetime\|date.today\|isoformat" "$CHECK_FILE" 2>/dev/null) || has_date=0

    echo "[$test_name] tool_messages: $tool_exec | tools_node: $tools_node | date_refs: $has_date"

    if [ "$tool_exec" -eq 0 ] && [ "$tools_node" -eq 0 ]; then
        echo "  FAIL: No tool execution detected in stream"
        TOOL_VERIFY_PASS=false
    else
        echo "  OK: Tool execution confirmed"
    fi
done

if [ "$TOOL_VERIFY_PASS" = false ]; then
    echo ""
    echo "WARNING: Some tool-calling tests did not produce tool executions"
    FAIL=$((FAIL + 1))
fi

# --- Summary ---
echo ""
echo "=============================================="
echo "Results: $PASS passed, $FAIL failed, $TOTAL total"
echo "Logs saved to: $LOG_DIR"
echo "=============================================="

[ $FAIL -eq 0 ] && exit 0 || exit 1
