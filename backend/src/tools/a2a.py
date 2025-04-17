from utils.a2a import A2ACardResolver, a2a_builder
from langchain_core.tools import StructuredTool

def a2a_tool(
    base_url: str,
    thread_id: str = None,
):
    card = A2ACardResolver(base_url=base_url).get_agent_card()
    async def send_task(query: str):
        return await a2a_builder(
            base_url=base_url, 
            query=query, 
            thread_id=thread_id
        )
    send_task.__doc__ = (
        f"Send query to remote agent: {card.name}. "
        f"Agent Card: {card.model_dump_json()}"
    )
    tool = StructuredTool.from_function(coroutine=send_task)
    tool.name = card.name.lower().replace(" ", "_")
    tool.description = card.description
    return tool
