---
title: Getting Started
sidebar_position: 2
---

# Getting Started with Orchestra

Welcome to Orchestra! This guide will walk you through your first steps with the platform, from logging in to sending your first AI-powered message.

## What You'll Learn

-   How to access your Orchestra instance
-   Creating your first conversation thread
-   Understanding and selecting AI models
-   Basic chat interactions
-   Exploring tools and integrations (optional)

## Prerequisites

Before you begin, ensure you have:

-   Access to an Orchestra instance (e.g., `https://orchestra.ruska.ai`)
-   User account credentials
-   A modern web browser

## Quick Start (5 minutes)

### Step 1: Log In

1. Navigate to your Orchestra instance in your web browser
2. Enter your credentials:
    - **Email**: Your user email (e.g., `admin@example.com` for demo)
    - **Password**: Your password
3. Click **Sign In**

You'll be redirected to the main chat interface.

### Step 2: Start a New Thread

When you first log in, you'll see the Orchestra interface with:

-   **Sidebar**: Shows your previous threads and assistants
-   **Main Chat Area**: Where conversations happen
-   **Model Selector**: At the top to choose your AI model

The interface automatically creates a new thread when you send your first message, or you can explicitly start a new thread from the sidebar.

### Step 3: Select Your Model

At the top of the chat interface, you'll see a model dropdown. Orchestra supports multiple AI providers:

-   **Anthropic**: Claude models (Haiku, Sonnet, Opus)
-   **OpenAI**: GPT models (GPT-5, GPT-4o, etc.)
-   **Google**: Gemini models
-   **xAI**: Grok models
-   **Groq**: Fast inference models

Click the dropdown and select your preferred model. For most use cases, we recommend:

-   **Claude Haiku 4.5**: Fast, cost-effective for simple tasks
-   **Claude Sonnet 4.5**: Balanced performance for complex reasoning
-   **GPT-4o**: Excellent for multi-modal tasks (text + images)

### Step 4: Send Your First Message

1. Click in the text input at the bottom of the screen
2. Type your message or question
3. Press **Enter** or click the **Send** button

Your message will be sent to the selected AI model, and you'll see the response appear in the chat thread.

**Example first messages:**

-   `What is Orchestra and what can it do?`
-   `Help me write a Python function to calculate fibonacci numbers`
-   `What's the latest news about AI development?` (requires search tool)

### Step 5: Explore Tools (Optional)

Orchestra's power comes from its ability to integrate external tools. To explore tools:

1. Click the **Tools** icon next to the message input
2. Browse available tools:
    - **Search**: Web search via Searx
    - **MCP Servers**: Configure Model Context Protocol integrations
    - **A2A Agents**: Connect to Agent-to-Agent protocol services

For now, try asking a question that requires web search:

```
What is the current price of Bitcoin?
```

If you have search tools configured, the AI will automatically use them to get real-time information.

## Understanding the Interface

### Sidebar Navigation

The left sidebar provides quick access to:

-   **Threads**: All your conversation histories
    -   Click any thread to resume that conversation
    -   Threads show preview text, timestamp, and model used
    -   Delete threads using the trash icon
-   **Assistants**: Pre-configured AI agents (more on this later)
    -   Create assistants with specific instructions and tools
    -   Reuse assistants across multiple threads

### User Menu

Click your avatar in the top-right to access:

-   **Prompts**: Saved prompt templates for common tasks
-   **Assistants**: Manage your assistant configurations
-   **Schedules**: Set up scheduled agent tasks (cron-based)
-   **Logout**: Sign out of your account

### Theme Toggle

Switch between light and dark mode using the theme toggle button at the top of the interface.

### File Editor Panel

When the AI generates code files or documents during a conversation, Orchestra displays them in a powerful, VSCode-like file editor interface:

![File Editor Panel](https://github.com/ryaneggz/static/blob/main/enso/file-editor-panel.png?raw=true)

**Key Features:**

-   **Multi-file Tabs**: Navigate between generated files using tabs at the top
-   **Syntax Highlighting**: Automatic language detection for 20+ programming languages (JavaScript, TypeScript, Python, Go, Rust, Java, C/C++, C#, PHP, Ruby, Swift, Kotlin, HTML, CSS, YAML, JSON, XML, SQL, Shell, Markdown, and more)
-   **Markdown Preview**: Toggle between code view and rendered preview for `.md` files
-   **Copy Content**: One-click copy of individual file contents to your clipboard
-   **Download Options**:
    -   Download individual files with the download button
    -   Download all files as a ZIP archive with one click

**When to Use:**

The file editor appears automatically when the AI generates multiple files or code artifacts. For example:

-   Ask the AI to "create a simple Express.js app with routes and middleware" - it will generate multiple JavaScript files
-   Request "write a Python script with tests" - you'll get the main script plus test files
-   Say "build a React component with styles" - receive the component file and CSS

**Usage Tips:**

!!! tip "Quick Navigation"
Use the file tabs to quickly switch between generated files. The active file is highlighted.

!!! tip "Markdown Preview"
For documentation files, use the preview toggle to see how your markdown will render.

!!! tip "Bulk Download"
Use the "Download All as ZIP" button to download entire project structures at once.

## What's Next?

Now that you've sent your first message, explore these features:

### Learn About Assistants

[Assistants](assistants/index.md) are pre-configured AI agents with specific instructions, tools, and personalities. They're perfect for:

-   Creating specialized agents (e.g., "Python Tutor", "Marketing Copywriter")
-   Reusing consistent behavior across conversations
-   Deploying via API for programmatic access

### Explore Protocol Integrations

-   **[Model Context Protocol (MCP)](tools/mcp.md)**: Connect to external tools and data sources
-   **[Agent-to-Agent (A2A)](tools/a2a.md)**: Enable multi-agent workflows
-   **[Search Integration](tools/search.md)**: Add web search capabilities

### Dive into the API

Orchestra provides a full REST API that mirrors the OpenAI Assistants API:

-   [API Documentation](https://orchestra.ruska.ai/api): Interactive API reference
-   Create threads programmatically
-   Build custom integrations
-   Deploy AI agents at scale

### Advanced Features

-   **[Storage & RAG](storage/index.md)**: Upload documents for retrieval-augmented generation
-   **[Projects](https://orchestra.ruska.ai/api#/Project)**: Organize document indexes for knowledge bases
-   **[Prompts](https://orchestra.ruska.ai/api#/Prompt)**: Create reusable prompt templates

## Tips for Success

!!! tip "Model Selection"
Different models excel at different tasks. Haiku for speed, Sonnet for reasoning, GPT-4o for vision tasks. Don't hesitate to switch models mid-conversation!

!!! info "Thread Management"
Threads maintain full conversation context. Long conversations may impact response time and cost - start a new thread for unrelated topics.

!!! warning "Tool Configuration"
MCP and A2A integrations require configuration before use. See the respective tool documentation for setup instructions.

## Getting Help

If you encounter issues or have questions:

-   **[Discord Community](https://discord.com/invite/QRfjg4YNzU)**: Get help from the community
-   **[GitHub Issues](https://github.com/ruska-ai)**: Report bugs or request features
-   **[API Docs](https://orchestra.ruska.ai/api)**: Detailed technical reference

---

**Ready to build?** Start exploring [Assistants](assistants/index.md) or dive into the [API Documentation](https://orchestra.ruska.ai/api).
