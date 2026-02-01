# exec-server (MCP)

An MCP server that exposes a single tool — `exec_command` — for executing shell commands inside a Docker container. Uses the [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) transport.

## Quick Start

```bash
cd orchestra
docker compose up exec_server --build -d
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_KEY` | No | If set, all `/mcp` requests must include `x-api-key` header |
| `PORT` | No | Server port (default: `3005`) |

## Test Commands

### 1. Initialize a session

```bash
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": { "name": "test", "version": "1.0.0" }
    },
    "id": 1
  }'
```

Note the `mcp-session-id` response header — include it in subsequent requests.

### 2. Send initialized notification

```bash
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <SESSION_ID>" \
  -d '{"jsonrpc": "2.0", "method": "notifications/initialized"}'
```

### 3. List tools

```bash
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <SESSION_ID>" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 2}'
```

### 4. Call exec_command

```bash
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "exec_command",
      "arguments": { "cmd": "echo hello world" }
    },
    "id": 3
  }'
```

### 5. Health check

```bash
curl http://localhost:3005/health
```

### With API key auth

If the container has `API_KEY` set, add the header to all requests:

```bash
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{ ... }'
```

## Orchestra Integration

Add as an MCP server in the orchestra UI:

| Field | Value |
|-------|-------|
| URL | `http://exec_server:3005/mcp` (docker network) or `http://localhost:3005/mcp` (host) |
| Transport | `streamable_http` |
| Headers | `{"x-api-key": "<API_KEY>"}` if auth is enabled, otherwise `{}` |

The `exec_command` tool will appear when fetching tools from the configured server.
