
from langgraph.prebuilt import ToolNode
from src.tools.retrieval import retrieval_query, retrieval_add, retrieval_load
from src.tools.agent import agent_builder, available_tools
from src.tools.sql import sql_query_read, sql_query_write
from src.tools.shell import shell_exec

tools = [       
    available_tools,
    shell_exec,
    retrieval_query,
    retrieval_add,
    retrieval_load,
    agent_builder,
    sql_query_read,
    sql_query_write,
]
tool_node = ToolNode(tools)

###################################### UTILS ######################################
def collect_tools(selected_tools: list[str]):
    filtered_tools = [tool for tool in tools if tool.name in selected_tools]
    if len(filtered_tools) == 0:
        raise ValueError(f"No tools found by the names: {selected_tools.join(', ')}")
    return filtered_tools


def dynamic_tools(selected_tools: list[str], metadata: dict = None):
    # Filter tools by name
    filtered_tools = [tool for tool in tools if tool.name in selected_tools]
    if len(filtered_tools) == 0:
        raise ValueError(f"No tools found by the names: {selected_tools.join(', ')}")
    
    # Update metadata for each tool
    for tool in filtered_tools:
        tool.metadata = metadata
        
    return filtered_tools