#!/bin/bash
# Test script for Multi-Turn Distributed Workers
# Usage: ./scripts/test-distributed-workers.sh [API_KEY]
#
# Prerequisites:
#   Terminal 1: DISTRIBUTED_WORKERS=true make dev
#   Terminal 2: uv run taskiq worker src.workers.tasks:broker

set -e

API_URL="${API_URL:-http://localhost:8000}"
API_KEY="${1:-}"
OUTPUT_DIR="./logs/distributed-test-$(date +%s)"

mkdir -p "$OUTPUT_DIR"

echo "=============================================="
echo "Multi-Turn Distributed Workers Test"
echo "=============================================="
echo "API URL: $API_URL"
echo "Output Dir: $OUTPUT_DIR"
echo ""

# Function to stream until [DONE] with proper termination
stream_until_done() {
    local url="$1"
    local output_file="$2"

    # Start curl in background, write to temp file
    local tmp_file=$(mktemp)
    curl -s -N "$url" ${API_KEY:+-H "x-api-key: $API_KEY"} > "$tmp_file" 2>&1 &
    local curl_pid=$!

    # Monitor the file for [DONE]
    local timeout=60
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        if grep -q "\[DONE\]" "$tmp_file" 2>/dev/null; then
            kill $curl_pid 2>/dev/null || true
            cat "$tmp_file" | tee "$output_file"
            rm -f "$tmp_file"
            return 0
        fi
        sleep 0.5
        elapsed=$((elapsed + 1))
    done

    # Timeout - kill curl and return what we have
    kill $curl_pid 2>/dev/null || true
    cat "$tmp_file" | tee "$output_file"
    rm -f "$tmp_file"
    echo "WARNING: Stream timed out"
}

# -----------------------------------------------------------------------------
# Turn 1: Send initial message
# -----------------------------------------------------------------------------
echo ">>> Turn 1: Sending initial message..."

TURN1_RESPONSE=$(curl -s -X POST "$API_URL/api/llm/stream" \
    -H "Content-Type: application/json" \
    ${API_KEY:+-H "x-api-key: $API_KEY"} \
    -d '{
        "input": {
            "messages": [{"role": "user", "content": "My favorite color is blue. Remember this."}]
        },
        "model": "openai:gpt-4.1-mini"
    }')

echo "$TURN1_RESPONSE" | tee "$OUTPUT_DIR/turn1_post.json"

# Extract thread_id
THREAD_ID=$(echo "$TURN1_RESPONSE" | grep -o '"thread_id":"[^"]*"' | cut -d'"' -f4)
DISTRIBUTED=$(echo "$TURN1_RESPONSE" | grep -o '"distributed":true')

if [ -z "$THREAD_ID" ]; then
    echo "ERROR: Failed to get thread_id"
    exit 1
fi

if [ -z "$DISTRIBUTED" ]; then
    echo "WARNING: distributed=true not in response. Is DISTRIBUTED_WORKERS=true set?"
fi

echo ""
echo "Thread ID: $THREAD_ID"
echo ""

# -----------------------------------------------------------------------------
# Stream Turn 1 results
# -----------------------------------------------------------------------------
echo ">>> Streaming Turn 1 results (waiting for worker)..."
sleep 2

stream_until_done "$API_URL/api/threads/$THREAD_ID/stream" "$OUTPUT_DIR/turn1_stream.txt"

# Extract AI response from stream
TURN1_AI_RESPONSE=$(grep '"values"' "$OUTPUT_DIR/turn1_stream.txt" 2>/dev/null | tail -1 | \
    grep -o '"content":"[^"]*"' | tail -1 | cut -d'"' -f4 || echo "")

echo ""
echo "Turn 1 AI Response: $TURN1_AI_RESPONSE"
echo ""

# -----------------------------------------------------------------------------
# Turn 2: Follow-up question
# -----------------------------------------------------------------------------
echo ">>> Turn 2: Asking follow-up question..."
sleep 2

TURN2_RESPONSE=$(curl -s -X POST "$API_URL/api/llm/stream" \
    -H "Content-Type: application/json" \
    ${API_KEY:+-H "x-api-key: $API_KEY"} \
    -d "{
        \"input\": {
            \"messages\": [{\"role\": \"user\", \"content\": \"What is my favorite color?\"}]
        },
        \"metadata\": {\"thread_id\": \"$THREAD_ID\"},
        \"model\": \"openai:gpt-4.1-mini\"
    }")

echo "$TURN2_RESPONSE" | tee "$OUTPUT_DIR/turn2_post.json"
echo ""

# -----------------------------------------------------------------------------
# Stream Turn 2 results
# -----------------------------------------------------------------------------
echo ">>> Streaming Turn 2 results (waiting for worker)..."
sleep 2

stream_until_done "$API_URL/api/threads/$THREAD_ID/stream" "$OUTPUT_DIR/turn2_stream.txt"

# The stream may replay from beginning, so get the last values entry
TURN2_AI_RESPONSE=$(grep '"values"' "$OUTPUT_DIR/turn2_stream.txt" 2>/dev/null | tail -1 | \
    grep -o '"content":"[^"]*"' | tail -1 | cut -d'"' -f4 || echo "")

echo ""
echo "Turn 2 AI Response: $TURN2_AI_RESPONSE"
echo ""

# -----------------------------------------------------------------------------
# Validation
# -----------------------------------------------------------------------------
echo "=============================================="
echo "VALIDATION"
echo "=============================================="

# Check if Turn 2 response mentions "blue"
if echo "$TURN2_AI_RESPONSE" | grep -qi "blue"; then
    echo "PASSED: Turn 2 correctly recalled 'blue' from Turn 1"
    echo ""
    echo "Multi-turn context preservation is WORKING!"
    EXIT_CODE=0
else
    echo "FAILED: Turn 2 did not recall 'blue' from Turn 1"
    echo ""
    echo "Turn 2 response was: $TURN2_AI_RESPONSE"
    EXIT_CODE=1
fi

echo ""
echo "Output files saved to: $OUTPUT_DIR"

exit $EXIT_CODE
