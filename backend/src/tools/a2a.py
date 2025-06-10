"""
A2A (Agent to Agent) tools
"""
from langchain_core.tools import StructuredTool

from src.schemas.entities.a2a import A2AServer
from src.utils.a2a import A2ACardResolver, a2a_builder

def init_a2a_tools(
    thread_id: str,
    a2a: dict[str, A2AServer], 
) -> list[StructuredTool]:
    tools = []
    if not a2a:
        return tools

    # Loop through each entry in the a2a dictionary
    for key, config in a2a.items():
        card = A2ACardResolver(
            base_url=config.base_url, 
            agent_card_path=config.agent_card_path
        ).get_agent_card()

        async def send_task(query: str, config=config):    
            return await a2a_builder(
                base_url=config.base_url, 
                query=query, 
                thread_id=thread_id
            )
        send_task.__doc__ = (
            f"Part of {key} A2A (Agent to Agent) server. "
            f"Send query to remote agent: {card.name}. "
            f"Agent Card: {card.model_dump_json()}"
        )
        tool = StructuredTool.from_function(coroutine=send_task)
        tool.name = card.name.lower().replace(" ", "_")
        tools.append(tool)

    return tools