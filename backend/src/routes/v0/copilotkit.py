from fastapi import FastAPI
from copilotkit import CopilotKitRemoteEndpoint, LangGraphAGUIAgent
from copilotkit.integrations.fastapi import add_fastapi_endpoint

from src.agents import init_graph
from src.constants.llm import DEFAULT_SYSTEM_PROMPT


def setup_copilotkit(app: FastAPI) -> None:
    """Register the CopilotKit runtime endpoint at /api/copilotkit.

    The endpoint bridges the CopilotKit frontend SDK to the Orchestra
    LangGraph backend using the AG-UI protocol.  The deep agent graph is
    lazily created on the first request so that the application store
    (set during lifespan) is available.
    """
    _cached_agents: list[LangGraphAGUIAgent] = []

    def get_agents(context):
        if not _cached_agents:
            store = getattr(app.state, "store", None)
            graph = init_graph(
                tools=[],
                subagents=[],
                system_prompt=DEFAULT_SYSTEM_PROMPT,
                middleware=[],
                store=store,
            )
            _cached_agents.append(
                LangGraphAGUIAgent(
                    name="deepagent",
                    graph=graph,
                    description="Orchestra deep agent with CopilotKit integration",
                )
            )
        return _cached_agents

    sdk = CopilotKitRemoteEndpoint(agents=get_agents)
    add_fastapi_endpoint(app, sdk, prefix="/api/copilotkit")
