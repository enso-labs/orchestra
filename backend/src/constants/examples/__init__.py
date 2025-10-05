import httpx
from fastapi.openapi.models import Example


MCP_REQ_BODY_EXAMPLE = {
    "mcp": {
        "enso_mcp": {
            "transport": "sse",
            "url": "https://mcp.enso.sh/sse",
            "headers": {"x-mcp-key": "your_api_key"},
        }
    }
}

A2A_REQ_BODY_EXAMPLE = {
    "a2a": {
        "currency_agent": {
            "base_url": "https://a2a.enso.sh",
            "agent_card_path": "/.well-known/agent.json",
        }
    }
}

ARCADE_REQ_BODY_EXAMPLE = {
    "arcade": {"tools": ["Web.ScrapeUrl"], "toolkits": ["Google"]}
}

ARCADE_RESPONSE_EXAMPLE = httpx.get(
    "https://raw.githubusercontent.com/ryaneggz/static/refs/heads/main/enso/mock-response-arcade.json"
).json()

NEW_THREAD_QUERY_EXAMPLE = {
    "system": "You are a helpful assistant.",
    "query": "What is the capital of France?",
    "model": "openai:gpt-4o",
    "tools": [],
    "images": [],
    "collection": {
        "id": "e208fbc9-92cd-4f50-9286-6eab533693c4",
        "limit": 10,
        "filter": {},
    },
    **A2A_REQ_BODY_EXAMPLE,
    **MCP_REQ_BODY_EXAMPLE,
    **ARCADE_REQ_BODY_EXAMPLE,
}

NEW_THREAD_API_TOOLS = {
    "system": "You are",
    "query": "List all the bases in Airtable",
    "model": "openai:o3-mini",
    "memory": True,
    "images": [],
    "tools": [
        {
            "name": "Airtable Tools",
            "description": "Airtable Tools",
            "headers": {"x-api-key": "1234567890"},
            "spec": httpx.get(
                "https://raw.githubusercontent.com/ryaneggz/static/refs/heads/main/enso/airtable-spec.json"
            ).json(),
        }
    ],
}

NEW_THREAD_ANSWER_EXAMPLE = {
    "thread_id": "443250c4-b9ec-4dfc-96fd-0eb3ec6ccb44",
    "answer": {
        "content": "The capital of France is Paris.",
        "additional_kwargs": {},
        "response_metadata": {
            "id": "msg_01MBf5kez6rvPXKLiF5cquS6",
            "model": "claude-3-5-sonnet-20240620",
            "stop_reason": "end_turn",
            "stop_sequence": None,
            "usage": {"input_tokens": 20, "output_tokens": 10},
        },
        "type": "ai",
        "name": None,
        "id": "run-1a31cbe1-e361-424d-bad4-d106d0b32256-0",
        "example": False,
        "tool_calls": [],
        "invalid_tool_calls": [],
        "usage_metadata": {
            "input_tokens": 20,
            "output_tokens": 10,
            "total_tokens": 30,
            "input_token_details": {},
        },
    },
}


EXISTING_THREAD_QUERY_EXAMPLE = {
    "query": "What about Germany?",
    "model": "openai:gpt-4o",
    "memory": True,
    "tools": [],
    "images": [],
    "collection": {
        "id": "e208fbc9-92cd-4f50-9286-6eab533693c4",
        "limit": 10,
        "filter": None,
    },
    **A2A_REQ_BODY_EXAMPLE,
    **MCP_REQ_BODY_EXAMPLE,
    **ARCADE_REQ_BODY_EXAMPLE,
}


EXISTING_THREAD_ANSWER_EXAMPLE = {
    "thread_id": "443250c4-b9ec-4dfc-96fd-0eb3ec6ccb44",
    "answer": {
        "content": "The capital of Germany is Berlin.",
        "additional_kwargs": {},
        "response_metadata": {
            "id": "msg_01NRjVLzASk28A1JaNXj1TwV",
            "model": "claude-3-5-sonnet-20240620",
            "stop_reason": "end_turn",
            "stop_sequence": None,
            "usage": {"input_tokens": 37, "output_tokens": 10},
        },
        "type": "ai",
        "name": None,
        "id": "run-6f5b5cc4-2b45-4486-8f92-ef14762039bc-0",
        "example": False,
        "tool_calls": [],
        "invalid_tool_calls": [],
        "usage_metadata": {
            "input_tokens": 37,
            "output_tokens": 10,
            "total_tokens": 47,
            "input_token_details": {},
        },
    },
}

THREAD_HISTORY_EXAMPLE = {
    "thread_id": "443250c4-b9ec-4dfc-96fd-0eb3ec6ccb44",
    "messages": [
        {
            "content": "You are a helpful assistant.",
            "additional_kwargs": {},
            "response_metadata": {},
            "type": "system",
            "name": None,
            "id": "8b6c3e63-a564-4738-8cd1-83f726efdd26",
        },
        {
            "content": "What is the capital of France?",
            "additional_kwargs": {},
            "response_metadata": {},
            "type": "human",
            "name": None,
            "id": "e70c5a2f-9a67-40d5-bdcd-f703edd1febe",
            "example": False,
        },
        {
            "content": "The capital of France is Paris.",
            "additional_kwargs": {},
            "response_metadata": {
                "id": "msg_01MBf5kez6rvPXKLiF5cquS6",
                "model": "claude-3-5-sonnet-20240620",
                "stop_reason": "end_turn",
                "stop_sequence": None,
                "usage": {"input_tokens": 20, "output_tokens": 10},
            },
            "type": "ai",
            "name": None,
            "id": "run-1a31cbe1-e361-424d-bad4-d106d0b32256-0",
            "example": False,
            "tool_calls": [],
            "invalid_tool_calls": [],
            "usage_metadata": {
                "input_tokens": 20,
                "output_tokens": 10,
                "total_tokens": 30,
                "input_token_details": {},
            },
        },
        {
            "content": "What about Germany?",
            "additional_kwargs": {},
            "response_metadata": {},
            "type": "human",
            "name": None,
            "id": "2215e75a-d440-4f95-acd0-c4ae5ae034f1",
            "example": False,
        },
        {
            "content": "The capital of Germany is Berlin.",
            "additional_kwargs": {},
            "response_metadata": {
                "id": "msg_01NRjVLzASk28A1JaNXj1TwV",
                "model": "claude-3-5-sonnet-20240620",
                "stop_reason": "end_turn",
                "stop_sequence": None,
                "usage": {"input_`tokens": 37, "output_tokens": 10},
            },
            "type": "ai",
            "name": None,
            "id": "run-6f5b5cc4-2b45-4486-8f92-ef14762039bc-0",
            "example": False,
            "tool_calls": [],
            "invalid_tool_calls": [],
            "usage_metadata": {
                "input_tokens": 37,
                "output_tokens": 10,
                "total_tokens": 47,
                "input_token_details": {},
            },
        },
    ],
}

ADD_DOCUMENTS_EXAMPLE = {
    "documents": [
        {
            "metadata": {
                "title": "The Boy Who Cried Wolf",
                "source": "https://en.wikipedia.org/wiki/The_Boy_Who_Cried_Wolf",
            },
            "page_content": (
                "The boy who cried wolf is a story about a boy who cried wolf "
                "to trick the villagers into thinking there was a wolf when there wasn't."
            ),
        },
        {
            "metadata": {
                "title": "The Three Little Pigs",
                "source": "https://en.wikipedia.org/wiki/The_Three_Little_Pigs",
            },
            "page_content": (
                "The three little pigs went to the market. "
                "One pig went to the store and bought a pound of sugar. "
                "Another pig went to the store and bought a pound of flour. "
                "The third pig went to the store and bought a pound of lard."
            ),
        },
        {
            "metadata": {
                "title": "Little Red Riding Hood",
                "source": "https://en.wikipedia.org/wiki/Little_Red_Riding_Hood",
            },
            "page_content": (
                "Little Red Riding Hood is a story about a young girl who "
                "goes to visit her grandmother, but is tricked by the wolf."
            ),
        },
    ]
}

LIST_DOCUMENTS_EXAMPLE = {
    "documents": [
        {
            "id": "317369e3-d061-4a7c-afea-948edea9856b",
            "text": (
                "The boy who cried wolf is a story about a boy "
                "who cried wolf to trick the villagers into thinking "
                "there was a wolf when there wasn't."
            ),
            "metadata": {
                "source": "https://en.wikipedia.org/wiki/The_Boy_Who_Cried_Wolf",
                "title": "The Boy Who Cried Wolf",
            },
            "type": "Document",
        },
        {
            "id": "84d83f48-b01b-4bf3-b027-765c61772344",
            "text": (
                "The three little pigs went to the market. One pig went to the store and bought "
                "a pound of sugar. Another pig went to the store and bought a pound of flour. "
                "The third pig went to the store and bought a pound of lard."
            ),
            "metadata": {
                "source": "https://en.wikipedia.org/wiki/The_Three_Little_Pigs",
                "title": "The Three Little Pigs",
            },
        },
    ]
}

A2A_GET_AGENT_CARD_EXAMPLE = {
    "agent_cards": [
        {
            "name": "Currency Agent",
            "description": "Helps with exchange rates for currencies",
            "url": "http://0.0.0.0:10000/",
            "provider": None,
            "version": "1.0.0",
            "documentationUrl": None,
            "capabilities": {
                "streaming": True,
                "pushNotifications": True,
                "stateTransitionHistory": False,
            },
            "authentication": None,
            "defaultInputModes": ["text", "text/plain"],
            "defaultOutputModes": ["text", "text/plain"],
            "skills": [
                {
                    "id": "convert_currency",
                    "name": "Currency Exchange Rates Tool",
                    "description": "Helps with exchange values between various currencies",
                    "tags": ["currency conversion", "currency exchange"],
                    "examples": ["What is exchange rate between USD and GBP?"],
                    "inputModes": None,
                    "outputModes": None,
                }
            ],
        }
    ]
}

LOGIN_RESPONSE_EXAMPLE = Example(
    summary="login_response",
    description="Login Response",
    value={
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "token_type": "bearer",
        "user": {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "username": "johndoe",
            "email": "john@example.com",
            "name": "John Doe",
        },
    },
)

SCHEDULE_FIND_EXAMPLE = Example(
    {
        "schedule": {
            "id": "3e2d3989-c701-43c2-bac7-05490508eabc",
            "trigger": {"type": "cron", "expression": "0 1 * * *"},
            "task": {
                "model": "openai:gpt-5-nano",
                "system": "You are a helpful assistant.",
                "messages": [{"role": "user", "content": "Weather in Dallas?"}],
            },
            "next_run_time": "2025-10-04T18:27:00-06:00",
        }
    }
)

SCHEDULE_LIST_EXAMPLE = Example(
    {
        "schedules": [
            {
                "id": "3e2d3989-c701-43c2-bac7-05490508eabc",
                "trigger": {"type": "cron", "expression": "0 1 * * *"},
                "task": {
                    "model": "openai:gpt-5-nano",
                    "system": "You are a helpful assistant.",
                    "tools": ["get_weather"],
                    "a2a": {},
                    "mcp": {},
                    "subagents": [],
                    "metadata": {},
                    "messages": [{"role": "user", "content": "Weather in Dallas?"}],
                },
                "next_run_time": "2025-10-04T18:27:00-06:00",
            }
        ]
    }
)
SCHEDULE_CREATE_EXAMPLE = Example(
    {
        "title": "Daily Weather Check",
        "trigger": {"type": "cron", "expression": "0 1 * * *"},
        "task": {
            "model": "openai:gpt-5-nano",
            "system": "You are a helpful assistant.",
            "messages": [{"role": "user", "content": "Weather in Dallas?"}],
            "tools": ["get_weather"],
        },
    }
)

SCHEDULE_UPDATE_EXAMPLE = Example(
    {
        "title": "Updated Daily Weather Check",
        "trigger": {"type": "cron", "expression": "0 2 * * *"},
        "task": {
            "model": "openai:gpt-5-nano",
            "system": "You are a helpful assistant.",
            "messages": [
                {"role": "user", "content": "Updated weather check for Dallas?"}
            ],
            "tools": ["get_weather"],
        },
    }
)


class Examples:
    LOGIN_RESPONSE_EXAMPLE = LOGIN_RESPONSE_EXAMPLE
    NEW_THREAD_QUERY_EXAMPLE = NEW_THREAD_QUERY_EXAMPLE
    NEW_THREAD_ANSWER_EXAMPLE = NEW_THREAD_ANSWER_EXAMPLE
    EXISTING_THREAD_QUERY_EXAMPLE = EXISTING_THREAD_QUERY_EXAMPLE
    EXISTING_THREAD_ANSWER_EXAMPLE = EXISTING_THREAD_ANSWER_EXAMPLE
    THREAD_HISTORY_EXAMPLE = THREAD_HISTORY_EXAMPLE
    ADD_DOCUMENTS_EXAMPLE = ADD_DOCUMENTS_EXAMPLE
    LIST_DOCUMENTS_EXAMPLE = LIST_DOCUMENTS_EXAMPLE
    A2A_GET_AGENT_CARD_EXAMPLE = A2A_GET_AGENT_CARD_EXAMPLE
    SCHEDULE_LIST_EXAMPLE = SCHEDULE_LIST_EXAMPLE
    SCHEDULE_CREATE_EXAMPLE = SCHEDULE_CREATE_EXAMPLE
    SCHEDULE_UPDATE_EXAMPLE = SCHEDULE_UPDATE_EXAMPLE
    SCHEDULE_FIND_EXAMPLE = SCHEDULE_FIND_EXAMPLE
    THREAD_SEARCH_EXAMPLES = {
        "list_threads": Example(
            summary="list_threads",
            description="List Threads in Checkpointer",
            value={"limit": 10, "offset": 0, "metadata": {}},
        ),
        "list_checkpoints": Example(
            summary="list_checkpoints",
            description="List Checkpoints for Thread",
            value={"limit": 10, "offset": 0, "metadata": {"thread_id": "thread_123"}},
        ),
        "get_checkpoint": Example(
            summary="get_checkpoint",
            description="Get Checkpoint for Thread",
            value={
                "limit": 10,
                "offset": 0,
                "metadata": {
                    "thread_id": "thread_123",
                    "checkpoint_id": "checkpoint_123",
                },
            },
        ),
    }

    LLM_INVOKE_EXAMPLES = {
        "stateless_invoke": Example(
            summary="stateless_invoke",
            description="LLM Stateless",
            value={
                "model": "openai:gpt-5-nano",
                "system": "You are a helpful assistant.",
                "messages": [{"role": "user", "content": "Weather in Dallas?"}],
                "tools": [],
                "mcp": {},
            },
        ),
        "persistant_thread": Example(
            summary="persistent_thread",
            description="LLM with Persistant Thread",
            value={
                "model": "openai:gpt-5-nano",
                "system": "You are a helpful assistant.",
                "metadata": {"thread_id": "thread_CkzLFPHdZX8ID6iZSP9pj"},
                "messages": [{"role": "user", "content": "Weather in Dallas?"}],
            },
        ),
        "branch_from_checkpoint": Example(
            summary="branch_from_checkpoint",
            description="Invoke LLM",
            value={
                "model": "openai:gpt-5-nano",
                "system": "You are a helpful assistant.",
                "metadata": {
                    "thread_id": "thread_CkzLFPHdZX8ID6iZSP9pj",
                    "checkpoint_id": "6fb4c17e-ff1d-46ca-af6d-ff289a019423",
                },
                "messages": [{"role": "user", "content": "Weather in Dallas?"}],
            },
        ),
        "deepagent": Example(
            summary="deepagent",
            description="Invoke DeepAgent Graph",
            value={
                "model": "openai:gpt-5-nano",
                "system": "You are a helpful assistant.",
                "metadata": {
                    "graph_id": "deepagent",
                },
                "messages": [{"role": "user", "content": "Weather in Dallas?"}],
            },
        ),
    }

    LLM_STREAM_EXAMPLES = {
        "stateless_stream": Example(
            summary="stateless_stream",
            description="LLM Stateless",
            value={
                "model": "openai:gpt-5-nano",
                "system": "You are a helpful assistant.",
                "stream_mode": "messages",
                "messages": [{"role": "user", "content": "Weather in Dallas?"}],
            },
        ),
        "persistant_thread": Example(
            summary="persistant_thread",
            description="LLM with Persistant Thread",
            value={
                "model": "openai:gpt-5-nano",
                "system": "You are a helpful assistant.",
                "stream_mode": "messages",
                "metadata": {"thread_id": "thread_CkzLFPHdZX8ID6iZSP9pj"},
                "messages": [{"role": "user", "content": "Weather in Dallas?"}],
            },
        ),
        "branch_from_checkpoint": Example(
            summary="branch_from_checkpoint",
            description="LLM with Branch from Checkpoint",
            value={
                "model": "openai:gpt-5-nano",
                "system": "You are a helpful assistant.",
                "stream_mode": "messages",
                "metadata": {
                    "thread_id": "thread_CkzLFPHdZX8ID6iZSP9pj",
                    "checkpoint_id": "6fb4c17e-ff1d-46ca-af6d-ff289a019423",
                },
                "messages": [{"role": "user", "content": "Weather in Dallas?"}],
            },
        ),
    }

    ASSISTANT_EXAMPLES = {
        "currency_agent": Example(
            name="Currency Agent",
            description="Helps with exchange rates for currencies",
            model="openai:gpt-5-nano",
            prompt="You are a helpful assistant.",
            tools=["web_search"],
            mcp=MCP_REQ_BODY_EXAMPLE["mcp"],
            a2a=A2A_REQ_BODY_EXAMPLE["a2a"],
            metadata={},
        ),
    }
