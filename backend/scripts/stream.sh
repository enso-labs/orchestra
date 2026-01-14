#!/bin/bash
  API_URL="http://localhost:8000/api"
  API_KEY="otk_ChTI2MXQZff0tFUATVC98Imz3hHInI8O-6cERwrbF5I"

  # Step 1: Submit task
  RESPONSE=$(curl -s -X POST "$API_URL/llm/stream" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d '{"input": {"messages": [{"role": "user", "content": "'"$1"'"}]}, "model": "openai:gpt-4.1-mini"}')

  THREAD_ID=$(echo $RESPONSE | jq -r '.thread_id')
  echo "Task enqueued. Thread ID: $THREAD_ID"

  # Step 2: Stream results
  curl -N "$API_URL/threads/$THREAD_ID/stream" -H "x-api-key: $API_KEY"