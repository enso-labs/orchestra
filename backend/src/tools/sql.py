import os

from langchain_core.tools import tool, ToolException
from langchain_community.agent_toolkits import SQLDatabaseToolkit
from langchain_community.agent_toolkits.sql.base import create_sql_agent
from langchain_community.utilities import SQLDatabase
from langchain_experimental.sql import SQLDatabaseChain

from src.constants import *
from src.utils.logger import logger
from src.utils.llm import LLMWrapper
from src.constants.llm import ModelName
@tool
def sql_query_read(question: str):
    """Execute a read-only query against a PostgreSQL database based on a natural language question.

    Args:
        question (str): A natural language question about the data (e.g., "How many users signed up last week?")
                       The question will be converted to a SELECT query automatically.

    Returns:
        dict: Response containing:
            - input: Original question
            - output: Query results
            - intermediate_steps: Steps showing question-to-SQL conversion and execution
    """
    try:
        logger.info(f"Running READ SQL query: {question}")
        db = SQLDatabase.from_uri(DB_URI_SANDBOX, engine_args={"pool_size": 20})
        user_repo = sql_query_read.metadata['user_repo']
        llm = LLMWrapper(
            model_name=ModelName.OPENAI_GPT_4O_MINI,
            api_key=OPENAI_API_KEY, 
            tools=[],
            user_repo=user_repo
        )
        toolkit = SQLDatabaseToolkit(db=db, llm=llm.model)
        agent = create_sql_agent(
            llm=llm.model, 
            toolkit=toolkit, 
            verbose=True if APP_LOG_LEVEL == "DEBUG" else False
        )
    
        response = agent.invoke(question)
        return response.get('output', 'Received empty response from SQL query')
    except ToolException as e:
        logger.error(f"Error running SQL query (READ): {str(e)}")
        raise e

@tool
def sql_query_write(question: str):
    """Execute a data modification query against a PostgreSQL database based on a natural language request.

    Args:
        question (str): A natural language request to modify data (e.g., "Delete all inactive users" or 
                       "Update John's email to john@example.com")
                       The request will be converted to an INSERT, UPDATE, or DELETE query automatically.

    Returns:
        dict: Response containing:
            - input: Original question
            - output: Query results
            - intermediate_steps: Steps showing question-to-SQL conversion and execution
    """
    try:
        logger.info(f"Running WRITE SQL query: {question}")
        db = SQLDatabase.from_uri(DB_URI_SANDBOX, engine_args={"pool_size": 20})
        user_repo = sql_query_write.metadata['user_repo']
        llm = LLMWrapper(
            model_name=ModelName.ANTHROPIC_CLAUDE_3_7_SONNET_LATEST,
            api_key=ANTHROPIC_API_KEY, 
            tools=[],
            user_repo=user_repo
        )
        db_chain = SQLDatabaseChain.from_llm(llm.model, db)
    
        response = db_chain.invoke(question)
        return response
    except ToolException as e:
        logger.error(f"Error running SQL query (WRITE): {str(e)}")
        raise e