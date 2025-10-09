from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field
from typing import Literal
from src.common.types import AgentCard
from src.utils.logger import logger
from src.utils.a2a import A2ACardResolver, a2a_builder
from src.constants.examples import (
    A2A_SERVER_EXAMPLE,
    A2A_DICT_EXAMPLE,
    MCP_SERVER_EXAMPLE,
    MCP_DICT_EXAMPLE,
)


class McpServer(BaseModel):
    transport: Literal["sse", "streamable_http", "stdio"]
    url: str
    headers: dict[str, str]

    # model_config = {
    #     "json_schema_extra": {
    #         "example": MCP_SERVER_EXAMPLE
    #     }
    # }


class McpServers(BaseModel):
    mcp: dict[str, McpServer] = Field(default_factory=dict[str, McpServer])

    model_config = {"json_schema_extra": {"example": MCP_DICT_EXAMPLE}}


class A2AServer(BaseModel):
    base_url: str
    agent_card_path: str

    model_config = {"json_schema_extra": {"example": A2A_SERVER_EXAMPLE}}


class A2AServers(BaseModel):
    a2a: dict[str, A2AServer] = Field(default_factory=dict[str, A2AServer])

    model_config = {"json_schema_extra": {"example": A2A_DICT_EXAMPLE}}

    def validate(self) -> bool:
        if not self.a2a:
            return False
        if not self.a2a.keys():
            return False
        for _, server in self.a2a.items():
            if not server.base_url or not server.agent_card_path:
                return False
        return True

    def fetch_agent_cards(self) -> list[AgentCard]:
        agent_cards = []
        for server in self.a2a.values():
            try:
                card = A2ACardResolver(
                    server.base_url, server.agent_card_path
                ).get_agent_card()
                agent_cards.append(card)
            except Exception as e:
                logger.error(f"Error fetching agent card for {server.base_url}: {e}")
        return agent_cards

    def fetch_agent_cards_as_tools(self, thread_id: str) -> list[StructuredTool]:
        tools = []
        for key, config in self.a2a.items():
            card = A2ACardResolver(
                config.base_url, config.agent_card_path
            ).get_agent_card()

            async def send_task(query: str, config: A2AServer = config):
                return await a2a_builder(config.base_url, query, thread_id)

            send_task.__doc__ = (
                f"Part of {key} A2A (Agent to Agent) server. "
                f"Send query to remote agent: {card.name}. "
                f"Agent Card: {card.model_dump_json()}"
            )
            tool = StructuredTool.from_function(coroutine=send_task)
            tool.name = card.name.lower().replace(" ", "_")
            tools.append(tool)
        return tools
