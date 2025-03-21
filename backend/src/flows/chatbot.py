from typing import TypedDict, Annotated
from langgraph.graph import StateGraph
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import SystemMessage
from pydantic import BaseModel
from langgraph.graph.message import add_messages

class State(TypedDict):
    messages: Annotated[list, add_messages]
    
# class Config(BaseModel):
#     llm: BaseChatModel

def create_chatbot(config: dict):
    def chatbot(state: State):
        messages = state["messages"]
        system = config.get('system')
        model: BaseChatModel = config.get('model')
        if system:
            # Check if there's already a SystemMessage at position 0
            if messages and isinstance(messages[0], SystemMessage):
                # Replace the existing SystemMessage
                messages[0] = SystemMessage(content=system)
            else:
                # Insert a new SystemMessage at the beginning
                messages.insert(0, SystemMessage(content=system))
        return {"messages": [model.invoke(messages)]}
    return chatbot

def chatbot_builder(config: dict):
    graph_builder = StateGraph(State)
    graph_builder.add_node("chatbot", create_chatbot(config))
    graph_builder.set_entry_point("chatbot")
    graph_builder.set_finish_point("chatbot")
    return graph_builder