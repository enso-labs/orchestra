# User Stories

## Issue #709: FEAT: Users should be able to configure Servers (MCP)

### Story 1: MCP Server Configuration CRUD
**As a** platform user,
**I want** to create, read, update, and delete MCP server configurations,
**So that** I can maintain a reusable library of MCP servers without re-entering connection details each time.

**Acceptance Criteria:**
- [ ] User can create a new MCP server configuration with name, URL/connection details, and metadata
- [ ] User can view a list of their saved MCP server configurations
- [ ] User can edit an existing MCP server configuration
- [ ] User can delete an MCP server configuration
- [ ] Server configurations are persisted to the database
- [ ] Server name must be unique per user/organization

### Story 2: Assign MCP Servers to Assistants
**As a** platform user,
**I want** to assign one or more saved MCP server configurations to an assistant,
**So that** I can quickly equip assistants with the tools from servers I've already configured.

**Acceptance Criteria:**
- [ ] User can select from their saved MCP servers when configuring an assistant
- [ ] Multiple servers can be assigned to a single assistant
- [ ] Assigned servers are persisted in the assistant configuration
- [ ] Removing a server assignment does not delete the server configuration itself

### Story 3: Load and Select Tools from Assigned Servers
**As a** platform user,
**I want** to see the available tools from each assigned MCP server and select which tools the assistant should use,
**So that** I have fine-grained control over which capabilities each assistant has.

**Acceptance Criteria:**
- [ ] Tools are loaded/discovered from each assigned MCP server
- [ ] User can see a list of tools per server
- [ ] User can select/deselect individual tools for the assistant
- [ ] Tool selections are saved with the assistant configuration
- [ ] Platform tools and MCP server tools are shown together but distinguishable

### Story 4: Reuse Server Configurations Across Assistants
**As a** platform user,
**I want** to reuse the same MCP server configuration across multiple assistants by selecting it by name,
**So that** I don't have to reconfigure the same server for every assistant.

**Acceptance Criteria:**
- [ ] The same server configuration can be assigned to multiple assistants
- [ ] Changes to a server configuration propagate to all assistants using it
- [ ] User can search/filter servers by name when assigning to assistants

## Notes
- The workflow is: configure servers → assign to assistant → load tools → select tools → save
- Server configurations should be referenced by string name for dynamic assignment
- Consider the relationship between server configs and organization/user scoping
