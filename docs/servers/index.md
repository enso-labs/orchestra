# Servers API - Product Requirements Document

## Overview
The Servers API enables users to create, manage, and share MCP (Message Control Protocol) and A2A (Agent-to-Agent) server configurations. This system will allow users to store their server configurations in a structured format, manage them over time, and optionally share them with the wider community on a public MCP/A2A page.

## API First Design
This document follows an API-first approach, defining the complete API interface before implementation. This ensures clear understanding of functionality, consistency in design, and enables parallel development of client applications.

## Data Model
The `servers` table will store JSON configurations for MCP and A2A servers with the following structure:

```sql
CREATE TABLE servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    slug VARCHAR NOT NULL UNIQUE,
    description TEXT,
    type VARCHAR NOT NULL, -- 'mcp' or 'a2a'
    config JSONB NOT NULL,
    public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX servers_user_id_idx ON servers(user_id);
CREATE INDEX servers_slug_idx ON servers(slug);
CREATE INDEX servers_public_idx ON servers(public);
CREATE INDEX servers_type_idx ON servers(type);
```

## Server Configuration Examples

### MCP Server Configuration
```json
{
  "enso_mcp": {
    "transport": "sse",
    "url": "https://mcp.enso.sh/sse",
    "headers": {
      "x-mcp-key": "your_api_key"
    }
  }
}
```

### A2A Server Configuration
```json
{
  "currency_agent": {
    "base_url": "https://a2a.enso.sh",
    "agent_card_path": "/.well-known/agent.json"
  }
}
```

## API Endpoints

### Server Management

#### GET /api/v0/servers
Get a list of servers owned by the authenticated user.

**Query Parameters:**
- `type` (optional): Filter by server type ('mcp' or 'a2a')
- `limit` (optional): Maximum number of results (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "servers": [
    {
      "id": "uuid",
      "name": "Enso MCP",
      "slug": "enso-mcp",
      "description": "Enso Message Control Protocol Server",
      "type": "mcp",
      "public": true,
      "created_at": "2023-06-15T12:00:00Z",
      "updated_at": "2023-06-15T12:00:00Z"
    }
  ],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

#### GET /api/v0/servers/public
Get a list of publicly shared servers.

**Query Parameters:**
- `type` (optional): Filter by server type ('mcp' or 'a2a')
- `limit` (optional): Maximum number of results (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Response:** Same as GET /api/v0/servers

#### GET /api/v0/servers/{id}
Get details for a specific server by ID.

**Response:**
```json
{
  "id": "uuid",
  "user_id": "user-uuid",
  "name": "Enso MCP",
  "slug": "enso-mcp",
  "description": "Enso Message Control Protocol Server",
  "type": "mcp",
  "config": {
    "enso_mcp": {
      "transport": "sse",
      "url": "https://mcp.enso.sh/sse",
      "headers": {
        "x-mcp-key": "encrypted-api-key"
      }
    }
  },
  "public": true,
  "created_at": "2023-06-15T12:00:00Z",
  "updated_at": "2023-06-15T12:00:00Z"
}
```

#### GET /api/v0/servers/by-slug/{slug}
Get details for a specific server by slug.

**Response:** Same as GET /api/v0/servers/{id}

#### POST /api/v0/servers
Create a new server configuration.

**Request Body:**
```json
{
  "name": "Enso MCP",
  "description": "Enso Message Control Protocol Server",
  "type": "mcp",
  "config": {
    "enso_mcp": {
      "transport": "sse",
      "url": "https://mcp.enso.sh/sse",
      "headers": {
        "x-mcp-key": "your_api_key"
      }
    }
  },
  "public": false
}
```

**Response:** 201 Created, with the same response format as GET /api/v0/servers/{id}

#### PUT /api/v0/servers/{id}
Update an existing server configuration.

**Request Body:** Same as POST /api/v0/servers

**Response:** Same as GET /api/v0/servers/{id}

#### PATCH /api/v0/servers/{id}
Partially update an existing server configuration.

**Request Body:**
```json
{
  "name": "Updated Enso MCP",
  "public": true
}
```

**Response:** Same as GET /api/v0/servers/{id}

#### DELETE /api/v0/servers/{id}
Delete a server configuration.

**Response:** 204 No Content

### Server Validation and Testing

#### POST /api/v0/servers/validate
Validate a server configuration without saving it.

**Request Body:** Same as POST /api/v0/servers

**Response:**
```json
{
  "valid": true,
  "errors": []
}
```

Or if invalid:
```json
{
  "valid": false,
  "errors": [
    {
      "field": "config.enso_mcp.url",
      "message": "URL is required"
    }
  ]
}
```

#### POST /api/v0/servers/{id}/test-connection
Test the connection to a saved server configuration.

**Response:**
```json
{
  "success": true,
  "latency_ms": 153,
  "message": "Successfully connected to server"
}
```

Or if unsuccessful:
```json
{
  "success": false,
  "error": "Connection timed out after 30 seconds",
  "details": {
    "error_code": "TIMEOUT",
    "url": "https://mcp.enso.sh/sse"
  }
}
```

## Integration with Thread API

The Server configurations will be used in the Thread API endpoints. When a saved server is referenced in a thread, it will be automatically wrapped with the appropriate parent object:

### Creating a New Thread with Server Configuration
```json
{
  "system": "You are a helpful assistant.",
  "query": "What is the capital of France?",
  "model": "openai-gpt-4o",
  "tools": [],
  "images": [],
  "a2a": {
    "currency_agent": {
      "base_url": "https://a2a.enso.sh",
      "agent_card_path": "/.well-known/agent.json"
    }
  },
  "mcp": {
    "enso_mcp": {
      "transport": "sse",
      "url": "https://mcp.enso.sh/sse",
      "headers": {
        "x-mcp-key": "your_api_key"
      }
    }
  }
}
```

### Using Saved Server in Thread API
```json
{
  "system": "You are a helpful assistant.",
  "query": "What is the capital of France?",
  "model": "openai-gpt-4o",
  "tools": [],
  "images": [],
  "servers": ["enso-mcp", "currency-agent-slug"]
}
```

### API for Agent Card Information
For A2A servers, we'll support retrieving agent card information:

#### GET /api/v0/servers/{id}/agent-card
Get the agent card information for an A2A server.

**Response:**
```json
{
  "agent_cards": [
    {
      "name": "Currency Agent",
      "description": "Helps with exchange rates for currencies",
      "url": "http://0.0.0.0:10000/",
      "provider": null,
      "version": "1.0.0",
      "documentationUrl": null,
      "capabilities": {
        "streaming": true,
        "pushNotifications": true,
        "stateTransitionHistory": false
      },
      "authentication": null,
      "defaultInputModes": [
        "text",
        "text/plain"
      ],
      "defaultOutputModes": [
        "text",
        "text/plain"
      ],
      "skills": [
        {
          "id": "convert_currency",
          "name": "Currency Exchange Rates Tool",
          "description": "Helps with exchange values between various currencies",
          "tags": [
            "currency conversion",
            "currency exchange"
          ],
          "examples": [
            "What is exchange rate between USD and GBP?"
          ],
          "inputModes": null,
          "outputModes": null
        }
      ]   
    }
  ]
}
```

## Security Considerations

1. **Sensitive Data**: 
   - Authentication tokens and API keys in server configurations will be encrypted before storage
   - Decryption will only occur when needed for API calls
   - Clear separation between public and private server details

2. **Access Control**:
   - Users can only view/modify their own server configurations
   - Public configurations expose limited information
   - Admin users can moderate public server listings

3. **Validation**:
   - All user input validated against schema
   - Sanitization of server configuration JSON
   - Rate limiting on validation and test endpoints

## Implementation Phases

### Phase 1: Core API
- Database schema creation
- Basic CRUD operations
- Authentication integration

### Phase 2: Security & Validation
- Encryption of sensitive data
- Connection testing functionality
- Input validation

### Phase 3: Public Sharing
- Public server listing
- Community features (ratings, comments)
- Admin moderation tools

## Client Integration

The API will support both backend and frontend integration:

1. **Backend integration**: 
   - Direct API calls for server-to-server communication
   - Authentication via JWT tokens

2. **Frontend integration**:
   - React components for server configuration management
   - Form validation that mirrors API validation
   - Connection testing UI

## Schema Validation

Server configurations will be validated against JSON schemas specific to each server type:

### MCP Schema
```json
{
  "type": "object",
  "minProperties": 1,
  "additionalProperties": {
    "type": "object",
    "required": ["transport", "url"],
    "properties": {
      "transport": {
        "type": "string",
        "enum": ["sse", "websocket", "http"]
      },
      "url": {
        "type": "string",
        "format": "uri"
      },
      "headers": {
        "type": "object",
        "additionalProperties": {
          "type": "string"
        }
      }
    }
  }
}
```

### A2A Schema
```json
{
  "type": "object",
  "minProperties": 1,
  "additionalProperties": {
    "type": "object",
    "required": ["base_url", "agent_card_path"],
    "properties": {
      "base_url": {
        "type": "string",
        "format": "uri"
      },
      "agent_card_path": {
        "type": "string"
      }
    }
  }
}
```
