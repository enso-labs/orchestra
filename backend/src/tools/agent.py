import json
import uuid
from langchain_core.tools import tool, ToolException

from psycopg_pool import ConnectionPool
from src.constants import DB_URI, CONNECTION_POOL_KWARGS
from src.utils.logger import logger

@tool
def available_tools():
    """List all available tools."""
    from src.tools import tools
    return [tool.name for tool in tools]

@tool
def agent_builder(query: str, system: str, tools: list[str], thread_id: str = None):
    """Build and run an AI agent with the specified configuration.
    
    Args:
        query (str): The user's question or request to be processed
        system (str): System message to set context and instructions for the agent
        tools (list[str]): List of tool names the agent should have access to
        thread_id (str): Unique identifier for the conversation thread, if not provided, a new thread will be created
        
    Returns:
        Response: JSON response containing the agent's answer and thread_id
        
    Example:
        .. code-block:: python
        
            response = agent_builder(
                thread_id="123e4567-e89b-12d3-a456-426614174000",
                query="What is the weather today?",
                system="You are a helpful weather assistant.",
                tools=["weather_query"]
            )
    """
    try:
        from src.services.db import get_connection_pool
        from src.utils.agent import Agent
        
        unique_id = str(uuid.uuid4())
        logger.info(f"Agent Builder Request:\n"
                f"Thread ID: {thread_id or unique_id}\n"
                f"System: {system}\n"
                f"Tools: {', '.join(tools)}\n"
                f"Query: {query}\n")
        
        with get_connection_pool() as pool:
            agent = Agent(thread_id or unique_id, pool)
            agent.builder(tools=tools)
            messages = agent.messages(query, system if not (thread_id or unique_id) else None)
            response = agent.process(messages, False)
            data = json.loads(response.body.decode('utf-8'))
            return {
                "thread_id": thread_id,
                "answer": data.get('answer').get('content')
            }
    except Exception as e:
        logger.error(f"Error in agent_builder: {str(e)}")
        raise ToolException(f"Error running agent: {str(e)}")