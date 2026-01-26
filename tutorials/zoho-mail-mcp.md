# Connecting Zoho Mail MCP to Send Emails

This tutorial walks you through connecting your Orchestra assistant to Zoho Mail using the Model Context Protocol (MCP), enabling your AI agent to send and manage emails autonomously.

## Overview

The Model Context Protocol (MCP) is a standardized interface that allows AI agents to interact seamlessly with external applications. By connecting Zoho Mail via MCP, your assistant gains the ability to:

- Send emails with or without attachments
- List and search emails in your inbox
- Mark emails as read/unread
- Move emails between folders
- Access full email content and threads

## Prerequisites

Before starting, ensure you have:

1. A Zoho Mail account
2. Access to your Orchestra instance (self-hosted or cloud)
3. One of the following MCP server options configured:
   - **Nango** (recommended for OAuth management)
   - **Composio** (simplified integration)
   - **Official Zoho MCP** (direct integration)

## Option 1: Using Nango with Zoho Mail MCP Server

This approach uses the [ampcome-mcps/zoho-mail-mcp](https://github.com/ampcome-mcps/zoho-mail-mcp) server with Nango for OAuth token management.

### Step 1: Set Up Nango

1. Create a free account at [nango.dev](https://nango.dev)
2. Create a new Zoho Mail integration with these OAuth scopes:
   - `ZohoMail.messages.ALL`
   - `ZohoMail.folders.ALL`
   - `ZohoMail.accounts.READ`
   - `ZohoMail.organization.ALL` (optional, for admin functions)
3. Complete the OAuth flow and note your credentials:
   - `NANGO_CONNECTION_ID`
   - `NANGO_INTEGRATION_ID`
   - `NANGO_SECRET_KEY`

### Step 2: Deploy the MCP Server

Clone and set up the Zoho Mail MCP server:

```bash
git clone https://github.com/ampcome-mcps/zoho-mail-mcp.git
cd zoho-mail-mcp
pip install -r requirements.txt
```

Create a `.env` file with your Nango credentials:

```env
NANGO_CONNECTION_ID=your_connection_id
NANGO_INTEGRATION_ID=your_integration_id
NANGO_BASE_URL=https://api.nango.dev
NANGO_SECRET_KEY=your_nango_secret_key
```

Run the MCP server:

```bash
python main.py
```

The server will start and expose an SSE endpoint (typically at `http://localhost:8000/sse`).

### Step 3: Connect to Orchestra

In the Orchestra UI:

1. Navigate to your assistant's **Tool Selection** panel
2. Click **MCP Servers** tab
3. Click **Add Server**
4. Configure the server:
   - **Server Name**: `zoho_mail`
   - **Transport**: `SSE`
   - **URL**: `http://localhost:8000/sse` (or your deployed server URL)
   - **Headers**: Leave empty if running locally

5. Click **Add Server**, then **Fetch Tools**

You should see the Zoho Mail tools appear:

| Tool | Description |
|------|-------------|
| `send_email` | Send an email message |
| `send_email_with_attachments` | Send email with file attachments |
| `list_emails` | List emails from inbox or specific folder |
| `search_emails` | Search emails with custom parameters |
| `get_email_content` | Get full email content by ID |
| `mark_emails_as_read` | Mark emails as read |
| `mark_emails_as_unread` | Mark emails as unread |
| `move_emails` | Move emails between folders |
| `delete_email` | Delete a specific email |

6. Select the tools you want your assistant to have access to
7. Save your assistant configuration

## Option 2: Using Composio

Composio provides a managed MCP server that simplifies OAuth and connection management.

### Step 1: Get Composio API Key

1. Sign up at [composio.dev](https://composio.dev)
2. Navigate to your dashboard and copy your API key

### Step 2: Connect Zoho Mail Account

```bash
pip install composio-core
composio add zoho_mail
```

Follow the OAuth prompts to authorize your Zoho Mail account.

### Step 3: Configure in Orchestra

1. In Orchestra UI, go to **Tool Selection** > **MCP Servers**
2. Click **Add Server**
3. Configure:
   - **Server Name**: `zoho_mail_composio`
   - **Transport**: `SSE`
   - **URL**: `https://mcp.composio.dev/zoho_mail/sse`
   - **Header Key**: `x-api-key`
   - **Header Value**: Your Composio API key

4. Click **Add Server** and **Fetch Tools**

## Option 3: Official Zoho MCP (Early Access)

Zoho offers an official MCP integration currently in early access.

1. Request access at [zoho.com/mcp](https://www.zoho.com/mcp/)
2. Once approved, follow Zoho's setup documentation
3. Configure the MCP server URL and OAuth credentials in Orchestra

## Using Your Email-Enabled Assistant

Once configured, you can interact with your assistant using natural language:

### Example Prompts

**Sending an email:**
```
Send an email to john@example.com with subject "Meeting Tomorrow"
and body "Hi John, Let's meet at 2 PM tomorrow to discuss the project."
```

**Checking inbox:**
```
Show me my latest 5 unread emails
```

**Searching emails:**
```
Find all emails from sarah@company.com about the Q4 report
```

**Managing emails:**
```
Mark the email from support@vendor.com as read and move it to the Archive folder
```

## API Integration

You can also configure Zoho Mail MCP programmatically via the Orchestra API:

```bash
curl -X POST "https://your-orchestra-instance/api/v0/assistants" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Email Assistant",
    "model": "openai:gpt-4.1-mini",
    "prompt": "You are an email assistant that helps users manage their Zoho Mail inbox.",
    "mcp": {
      "zoho_mail": {
        "transport": "sse",
        "url": "https://your-mcp-server.com/sse",
        "headers": {
          "x-api-key": "your_api_key"
        }
      }
    }
  }'
```

## Troubleshooting

### Connection Issues

- **Error: Failed to connect to MCP server**
  - Verify the MCP server URL is accessible
  - Check that the server is running and healthy
  - Ensure firewall rules allow the connection

### Authentication Errors

- **Error: OAuth token expired**
  - Re-authenticate through Nango or Composio
  - Check that OAuth scopes are correctly configured

### Missing Tools

- **Tools not appearing after Fetch**
  - Verify the MCP server is returning tool definitions
  - Check server logs for errors
  - Ensure the correct endpoint (`/sse` or `/mcp`) is configured

## Security Considerations

- Store OAuth tokens and API keys securely using environment variables
- Use HTTPS for all MCP server connections in production
- Regularly rotate API keys and review access permissions
- Consider using a dedicated Zoho account for AI agent access with limited permissions

## Related Resources

- [Zoho MCP Documentation](https://www.zoho.com/mcp/)
- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Composio Zoho Mail Integration](https://composio.dev/toolkits/zoho_mail/)
- [Nango OAuth Documentation](https://docs.nango.dev/)

## Next Steps

- Explore combining Zoho Mail with other MCP servers (Calendar, CRM)
- Set up scheduled email workflows using Orchestra's scheduler
- Create email automation assistants for customer support
