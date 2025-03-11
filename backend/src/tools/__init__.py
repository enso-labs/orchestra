
from langgraph.prebuilt import ToolNode
from langchain_core.tools import Tool
from src.tools.retrieval import retrieval_query, retrieval_add, retrieval_load
from src.tools.agent import agent_builder, available_tools
from src.tools.sql import sql_query_read, sql_query_write
from src.tools.shell import shell_exec
from src.tools.search import search_engine
from src.tools.finance import get_stock_price, get_stock_info, get_stock_news, get_stock_history, get_stock_dividends, get_stock_actions, get_stock_financials, get_stock_recommendations, get_stock_holders
tools = [       
    # available_tools,
    shell_exec,
    retrieval_query,
    retrieval_add,
    retrieval_load,
    # agent_builder,
    sql_query_read,
    sql_query_write,
    search_engine,
    # finance
    get_stock_price,
    get_stock_info,
    get_stock_news,
    get_stock_history,
    get_stock_dividends,
    get_stock_actions,
    get_stock_financials,
    get_stock_recommendations,
    get_stock_holders,
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

def attach_tool_details(tool):
    if tool['id'] == "shell_exec":
        tool['tags'] = ["shell"]
    elif tool['id'] == "sql_query_read" or tool['id'] == "sql_query_write":
        tool['tags'] = ["sql"]
    elif tool['id'] == "search_engine":
        tool['tags'] = ["search"]
    elif tool['id'] == "retrieval_query" or tool['id'] == "retrieval_add" or tool['id'] == "retrieval_load":
        tool['tags'] = ["retrieval"]
    elif tool['id'] == "get_stock_price" or tool['id'] == "get_stock_info" or tool['id'] == "get_stock_news" or tool['id'] == "get_stock_history" or tool['id'] == "get_stock_dividends" or tool['id'] == "get_stock_actions" or tool['id'] == "get_stock_financials" or tool['id'] == "get_stock_recommendations" or tool['id'] == "get_stock_holders":
        tool['tags'] = ["finance"]  
    return tool