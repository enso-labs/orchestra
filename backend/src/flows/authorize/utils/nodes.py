from langgraph.graph import END, MessagesState
from langgraph.errors import NodeInterrupt


# Function to invoke the model and get a response
def call_agent(state: MessagesState, config: dict):
    messages = state["messages"]
    model = config["configurable"].get("model")
    tools = config["configurable"].get("tools")
    if tools:
        model = model.bind_tools(tools)
    response = model.invoke(messages)
    # Return the updated message history
    return {"messages": [response]}


# Function to determine the next step in the workflow based on the last message
def should_continue(state: MessagesState, config: dict):
    tool_manager = config["configurable"].get("tool_manager")
    if state["messages"][-1].tool_calls:
        for tool_call in state["messages"][-1].tool_calls:
            try:
                if tool_manager.requires_auth(tool_call["name"]):
                    return "authorization"
            except ValueError:
                return "tools"
        return "tools"  # Proceed to tool execution if no authorization is needed
    return END  # End the workflow if no tool calls are present


# Function to handle authorization for tools that require it
def authorize(state: MessagesState, config: dict):
    tool_manager = config["configurable"].get("tool_manager")
    user_id = config["configurable"].get("user_id")
    for tool_call in state["messages"][-1].tool_calls:
        tool_name = tool_call["name"]
        if not tool_manager.requires_auth(tool_name):
            continue
        auth_response = tool_manager.authorize(tool_name, user_id)
        if auth_response.status != "completed":
            # Prompt the user to visit the authorization URL
            # interrupt(f"Visit the following URL to authorize: {auth_response.url}")
            return NodeInterrupt(
                f"Visit the following URL to authorize: {auth_response.url}"
            )

            # Wait for the user to complete the authorization
            # and then check the authorization status again
            tool_manager.wait_for_auth(auth_response.id)
            if not tool_manager.is_authorized(auth_response.id):
                # This stops execution if authorization fails
                raise ValueError("Authorization failed")

    return {"messages": []}
