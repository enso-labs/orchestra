# Model Context Protocol [(MCP)](https://modelcontextprotocol.io/introduction)

<a href="https://discord.com/invite/QRfjg4YNzU"><img src="https://img.shields.io/badge/Join-Discord-purple"></a>
<a href="https://demo.enso.sh/api"><img src="https://img.shields.io/badge/View-API Docs-blue"></a>
<a href="https://enso.sh/socials"><img src="https://img.shields.io/badge/Follow-Social-black"></a>

[MCP](https://modelcontextprotocol.io/introduction) is an open protocol that standardizes how applications provide context to LLMs. Think of MCP like a USB-C port for AI applications. Just as USB-C provides a standardized way to connect your devices to various peripherals and accessories, MCP provides a standardized way to connect AI models to different data sources and tools.

![Landing Page](https://github.com/ryaneggz/static/blob/main/enso/mcp-enable.gif?raw=true)

## Introduction

Enso Labs MCP support is based on the [Langchain MCP Adapter](https://github.com/langchain-ai/langchain-mcp-adapters) repository. A sample MCP server can be found at [Enso Labs - MCP SSE Server](https://github.com/enso-labs/mcp-sse). 

See this [permalink](https://github.com/enso-labs/mcp-sse/blob/caa79bee4af4914d729ef1989156b66966121d80/main.py#L22-L27) for an example for how to include `x-mcp-key` authentication.

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

## Example [API Usage](https://demo.enso.sh/api#/Thread/Create_New_Thread_api_threads_post):

#### GET MCP server information

```bash
curl -X 'POST' \
  'https://demo.enso.sh/api/tools/mcp/info' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "mcp": {
    "enso_mcp": {
      "headers": {
        "x-mcp-key": "your_api_key"
      },
      "transport": "sse",
      "url": "https://mcp.enso.sh/sse"
    }
  }
}'
```

#### Request: `Create New Thread`

```bash
curl -X 'POST' \
  'https://demo.enso.sh/api/threads' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "images": [],
  "mcp": {
    "enso_mcp": {
      "headers": {
        "x-mcp-key": "your_api_key"
      },
      "transport": "sse",
      "url": "https://mcp.enso.sh/sse"
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
    "content": "The latest price of Bitcoin appears to vary among the sources. According to a search result from Yahoo Finance, the last known price of Bitcoin is approximately $97,305.19 per BTC, while a result from Coinbase lists Bitcoin at $88,316.34 per BTC. Prices can vary slightly between exchanges due to different market conditions. For the most accurate and current price, you might want to check a live cryptocurrency exchange platform like [Coinbase](https://www.coinbase.com/price/bitcoin) or [Yahoo Finance](https://finance.yahoo.com/quote/BTC-USD/).",
    //... Response Metadata
  }
}
```
