---
title: Orchestra Docs
description: Composable agent infrastructure built on LangGraph with MCP and A2A support.
---

# Orchestra Docs

[![Join Slack](https://img.shields.io/badge/Join-Slack-4A154B?logo=slack&logoColor=white)](https://join.slack.com/t/ruska-ai/shared_invite/zt-3l2lnevo6-hOe5ZeoAz~xj7CFAJk2bzg)
[![View API Docs](https://img.shields.io/badge/View-API%20Docs-blue)](https://chat.ruska.ai/docs)
[![Follow Social](https://img.shields.io/badge/Follow-Social-black)](https://ruska.ai/socials)

:::info Living Documentation
This documentation is actively maintained and continuously updated as Orchestra evolves. Features, APIs, and best practices are regularly refined. For the most current information, check back frequently or join our [Slack community](https://join.slack.com/t/ruska-ai/shared_invite/zt-3l2lnevo6-hOe5ZeoAz~xj7CFAJk2bzg).
:::

Orchestra is a composable AI agent infrastructure built on LangGraph and powered by the [MCP](https://github.com/modelcontextprotocol) & [A2A](https://github.com/google/A2A) protocols by [Ruska Labs](https://ruska.ai).

## What is Orchestra?

Orchestra provides a flexible, API-first platform for building and deploying AI agents. Unlike monolithic AI solutions, Orchestra gives you the freedom to compose your own AI workflows using best-in-class protocols and models.

**The goal of Orchestra is to enrich the lives of the curious** - those who seek to buy back their time and compound their personal growth. Those who build and don't wait for IT to be built for them.

## Who Is This For?

-   **Developers** building AI-powered applications who need flexible, protocol-based integrations
-   **Teams** wanting to leverage multiple AI models and tools in a unified platform
-   **Organizations** seeking to maintain control over their AI infrastructure while using open standards
-   **Innovators** who want to experiment with cutting-edge agent protocols (MCP, A2A)

![Landing Page](https://github.com/ryaneggz/static/blob/main/enso/landing-page-light.gif?raw=true)

## Core Features

### 🤖 Flexible AI Assistants

Create pre-configured AI agents with specific instructions, tools, and behaviors. Deploy them via API or use them directly in the web interface.

-   **Custom Instructions**: Define personality and expertise for each assistant
-   **Tool Integration**: Connect assistants to MCP servers, A2A agents, and built-in tools
-   **Persistent Configuration**: Save and reuse assistant configurations across projects

[Learn more about Assistants →](assistants/index.md)

### 💬 Conversation Threads

Manage stateful conversations with full message history and context persistence.

-   **Message History**: Full conversation tracking with tool execution logs
-   **File Attachments**: Upload and reference documents within threads
-   **Model Flexibility**: Switch between models mid-conversation
-   **Multi-Modal Support**: Text, images, and audio inputs

[Learn more about Threads →](threads/index.md)

### 🔌 Protocol Integration

Orchestra provides native support for open agent protocols, making it easy to connect external tools and services.

-   **[Model Context Protocol (MCP)](./tools/mcp.md)**: Connect to MCP-compatible tools and data sources
-   **[Agent-2-Agent (A2A)](./tools/a2a.md)**: Enable communication between autonomous agents
-   **[Search Integration](./tools/search.md)**: Built-in web search via Searx

[Explore Tools & Integrations →](tools/tools.md)

### 📁 Storage & RAG

S3-compatible object storage with document retrieval capabilities for building knowledge-enhanced agents.

-   **File Management**: Upload and manage documents via S3-compatible API (MinIO)
-   **RAG Projects**: Create searchable document indexes for retrieval-augmented generation
-   **Flexible Querying**: Filter and search across your document collections

[Learn more about Storage →](storage/index.md)

## Quick Start

Ready to get started? Follow our [Getting Started Guide](getting-started.md) to:

1. Access your Orchestra instance
2. Create your first conversation thread
3. Select and configure AI models
4. Integrate external tools via MCP or A2A

## Community & Support

-   **[Slack](https://join.slack.com/t/ruska-ai/shared_invite/zt-3l2lnevo6-hOe5ZeoAz~xj7CFAJk2bzg)**: Join our community for discussions and support
-   **[GitHub](https://github.com/ruska-ai)**: Contribute to Ruska Labs projects
-   **[API Documentation](https://chat.ruska.ai/docs)**: Complete API reference and interactive docs
-   **[Social Media](https://ruska.ai/socials)**: Follow us for updates and news

---

_Orchestra is developed by [Ruska Labs](https://ruska.ai) - enriching the lives of builders and innovators._
