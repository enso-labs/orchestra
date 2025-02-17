import json
from langgraph.graph import StateGraph
from langchain_core.messages import AnyMessage, ToolMessage, AIMessageChunk, ToolMessageChunk, HumanMessage
from src.utils.logger import logger

async def event_stream(
    graph: StateGraph, 
    messages: list[AnyMessage],
    thread_id: str = None,
    stream_mode: str = "values"
):
    for chunk in graph.stream(
        {"messages": messages}, 
        {'configurable': {'thread_id': thread_id}},
        stream_mode=stream_mode
    ):
        for node_name, node_results in chunk.items():
            chunk_messages = node_results.get("messages", [])
            for message in chunk_messages:
                if not message.content:
                    continue
                if isinstance(message, ToolMessage):
                    event_str = "event: tool_event"
                else:
                    event_str = "event: ai_event"
                data_str = f"data: {message.content}"
                print(f"{event_str}\n{data_str}\n\n")
                yield f"{event_str}\n{data_str}\n\n"
                
                
# def stream_graph_values(
#     graph: StateGraph, 
#     messages: list[AnyMessage],
#     thread_id: str = None,
#     stream_mode: str = "messages"
# ):
#     for chunk in graph.stream(
#         {"messages": messages}, 
#         {'configurable': {'thread_id': thread_id}},
#         stream_mode=stream_mode
#     ):
#         print(chunk)
#         message: AnyMessage = chunk[0]
#         print(type(message))
#         if message.content:
#             yield handle_types(message)

# async def stream_chunks(
#     graph: StateGraph, 
#     messages: list[AnyMessage],
#     thread_id: str = None,
#     stream_mode: str = "messages"
# ):
#     async for msg, metadata in graph.stream(
#         {"messages": messages}, 
#         {'configurable': {'thread_id': thread_id}},
#         stream_mode=stream_mode
#     ):
#         print(msg, metadata)
#         yield msg

# Custom function to process the output
def process_stream_output(
    graph: StateGraph, 
    state: dict,
    thread_id: str = None,
    stream_mode: str = "messages"
):
    for msg, metadata in graph.stream(
        state, 
        {'configurable': {'thread_id': thread_id}} if thread_id else {},
        stream_mode=stream_mode
    ):
        if msg.content and not isinstance(msg, HumanMessage):
            # Convert message content to SSE format
            content = msg.content
            if not isinstance(content, str):
                content = content[0].text
            data = {
                "thread_id": thread_id,
                "event": "ai_chunk" if isinstance(msg, AIMessageChunk) else "tool_chunk",
                "content": content
            }
            yield f"data: {json.dumps(data)}\n\n"
        else:
            print(msg)
        
def stream_chunks(
    graph: StateGraph, 
    state: dict,
    config: str = None,
    stream_mode: str = "messages"
):
    first = True
    try:
        thread_id = config.get("configurable", {}).get("thread_id")
        for msg, metadata in graph.stream(
            state, 
            config,
            stream_mode=stream_mode
        ):
            if msg.content and not isinstance(msg, HumanMessage):
                # Convert message content to SSE format
                content = msg.content
                if not isinstance(content, str):
                    content = content[0].get('text')
                data = {
                    "thread_id": thread_id,
                    "event": "ai_chunk" if isinstance(msg, AIMessageChunk) else "tool_chunk",
                    "content": content
                }
                yield f"data: {json.dumps(data)}\n\n"

            if isinstance(msg, AIMessageChunk):
                if first:
                    gathered = msg
                    first = False
                else:
                    gathered = gathered + msg

                if msg.tool_call_chunks:
                    tool_data = {
                        "event": "tool_call",
                        "content": str(gathered.tool_calls)
                    }
                    yield f"data: {json.dumps(tool_data)}\n\n"
    
    except Exception as e:
        logger.error("Error in stream_chunks", e)
    finally:
        logger.info("Closing stream")
        # Send end event
        end_data = {
            "thread_id": thread_id,
            "event": "end",
            "content": []
        }
        yield f"data: {json.dumps(end_data)}\n\n"

def stream_tokens(
    graph: StateGraph, 
    messages: list[AnyMessage],
    thread_id: str = None,
    stream_mode: str = "messages"
):
    for chunk in graph.stream(
        {"messages": messages}, 
        {'configurable': {'thread_id': thread_id}},
        stream_mode=stream_mode
    ):
        print(chunk)
        message: AnyMessage = chunk[0]
        print(type(message))
        if message.content:
            yield handle_types(message)
        
def handle_types(message: AnyMessage):
    data = {
        "event": "end",
        "content": message.content,
    }
    if isinstance(message, ToolMessage):
        data["event"] = "tool_call"
        
    if isinstance(message, ToolMessageChunk):
        data["event"] = "tool_chunk"
        
    if isinstance(message, AIMessageChunk):
        data["event"] = "ai_chunk"
        data["content"] = message.content[-1].get('text')
        
    # logging.debug(f'[utils.stream.handle_types]: {str(data)}')
    return f"data: {json.dumps(data)}\n\n"
