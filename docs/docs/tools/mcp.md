---
title: MCP
slug: /tools/mcp
---

# Model Context Protocol [(MCP)](https://modelcontextprotocol.io/introduction)

[![Join Discord](https://img.shields.io/badge/Join-Discord-purple)](https://discord.com/invite/QRfjg4YNzU)
[![View API Docs](https://img.shields.io/badge/View-API%20Docs-blue)](https://orchestra.ruska.ai/api)
[![Follow Social](https://img.shields.io/badge/Follow-Social-black)](https://ruska.ai/socials)

:::info Actively Evolving
MCP integration is actively being enhanced with new features and capabilities. This documentation reflects the current implementation and is updated regularly.
:::

[MCP](https://modelcontextprotocol.io/introduction) is an open protocol that standardizes how applications provide context to LLMs. Think of MCP like a USB-C port for AI applications. Just as USB-C provides a standardized way to connect your devices to various peripherals and accessories, MCP provides a standardized way to connect AI models to different data sources and tools.

![Landing Page](https://github.com/ryaneggz/static/blob/main/enso/mcp-enable.gif?raw=true)

## Introduction

Ruska Labs MCP support is based on the [Langchain MCP Adapter](https://github.com/langchain-ai/langchain-mcp-adapters) repository. A sample MCP server can be found at [Ruska Labs - MCP SSE Server](https://github.com/ruska-ai/mcp-sse).

See this [permalink](https://github.com/ruska-ai/mcp-sse/blob/caa79bee4af4914d729ef1989156b66966121d80/main.py#L22-L27) for an example for how to include `x-mcp-key` authentication.

## Quick Start

1. Open the Tool Selector modal then click the icon that displays the **Add MCP Configuration** panel.

    ![Configure MCP](https://github.com/ryaneggz/static/blob/main/enso/configure-mcp.png?raw=true)

2. Edit the default MCP Configuration displayed in the JSON Editor. When finished press the **Save Configuration** at the bottom of the panel.

    This will store the configuration in your `localStorage` with the key `mcp-config`.

    ![Edit Configuration](https://github.com/ryaneggz/static/blob/main/enso/mcp-editor.png?raw=true)

3. After **Save Configuration** you should see the MCP server tool information fetched from the defined MCP servers.

    ![MCP Info](https://github.com/ryaneggz/static/blob/main/enso/mcp-info.png?raw=true)

4. Now that the configuration is saved, close the panel, edit the input, and click submit. You will see tool executions appear in the Thread following the User message and before the AI response.

    ![MCP Query](https://github.com/ryaneggz/static/blob/main/enso/mcp-query.png?raw=true)

5. Click on the ToolMessage to view its execution details.

    ![MCP Tool Execution](https://github.com/ryaneggz/static/blob/main/enso/mcp-toolcall.png?raw=true)

## How MCP Configuration Works

The `mcp` property accepts a **dictionary of server names** mapped to their configurations. This allows you to connect multiple MCP servers simultaneously:

```json
{
    "mcp": {
        "server_name_1": {
            "transport": "sse",
            "url": "https://mcp-server1.example.com",
            "headers": {
                "x-mcp-key": "your_key_1"
            }
        },
        "server_name_2": {
            "transport": "sse",
            "url": "https://mcp-server2.example.com",
            "headers": {
                "x-mcp-key": "your_key_2"
            }
        }
    }
}
```

Each key in the `mcp` dictionary is a unique server name you choose (e.g., `"weather_server"`, `"database_server"`, `"ruska_mcp"`).

### Granular Tool Selection

Once MCP servers are configured, you can selectively enable specific tools from those servers using the `tools` property:

```json
{
    "query": "Get the weather in Denver",
    "model": "anthropic:claude-sonnet-4-5",
    "mcp": {
        "weather_server": {
            "transport": "sse",
            "url": "https://weather-mcp.example.com"
        },
        "database_server": {
            "transport": "sse",
            "url": "https://db-mcp.example.com"
        }
    },
    "tools": [
        "get_weather", // From weather_server
        "get_forecast", // From weather_server
        "query_database", // From database_server
        "search" // Built-in platform tool
    ]
}
```

**Benefits of Granular Tool Selection:**

-   **Load multiple MCP servers** at once without enabling all their tools
-   **Restrict assistants** to specific tools from those servers for better security
-   **Mix MCP tools** with built-in platform tools like `search`
-   **Better performance** through selective tool access - fewer tools means faster inference

**Example with Assistants:**

```bash
curl -X 'POST' \
  'https://orchestra.ruska.ai/api/assistant' \
  -H 'Content-Type: application/json' \
  -d '{
  "name": "Weather Assistant",
  "instructions": "You are a weather information assistant.",
  "model": "anthropic:claude-sonnet-4-5",
  "mcp": {
    "weather_server": {
      "transport": "sse",
      "url": "https://weather-mcp.example.com"
    }
  },
  "tools": ["get_weather", "search"]
}'
```

This assistant has access to the `get_weather` tool from the MCP server and the built-in `search` tool, but NOT other tools the weather server might expose.

## Example [API Usage](https://orchestra.ruska.ai/api#/Thread/Create_New_Thread_api_threads_post):

#### GET MCP server information

```bash
curl -X 'POST' \
  'https://orchestra.ruska.ai/api/tools/mcp/info' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "mcp": {
    "ruska_mcp": {
      "headers": {
        "x-api-key": "your_api_key"
      },
      "transport": "streamable_http",
      "url": "https://mcp.ruska.ai/sse"
    }
  }
}'
```

#### Request: `Create New Thread`

```bash
curl -X 'POST' \
  'https://orchestra.ruska.ai/api/llm/thread' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "images": [],
  "mcp": {
    "ruska_mcp": {
      "headers": {  
        "x-api-key": "your_api_key"
      },
      "transport": "http",
      "url": "https://chat.ruska.ai/mcp"
    }
  },
  "model": "openai-gpt-4o",
  "query": "What is the latest Bitcoin price? Use search.",
  "system": "You are a helpful assistant.",
  "tools": []
}' | jq
```

### Response JSON: `Create New Thread`

```json
{
    "thread_id": "698e540b-8ae3-4db7-b5c5-526c438c4266",
    "answer": {
        "content": "The latest price of Bitcoin appears to vary among the sources. According to a search result from Yahoo Finance, the last known price of Bitcoin is approximately $97,305.19 per BTC, while a result from Coinbase lists Bitcoin at $88,316.34 per BTC. Prices can vary slightly between exchanges due to different market conditions. For the most accurate and current price, you might want to check a live cryptocurrency exchange platform like [Coinbase](https://www.coinbase.com/price/bitcoin) or [Yahoo Finance](https://finance.yahoo.com/quote/BTC-USD/)."
        //... Response Metadata
    }
}
```
