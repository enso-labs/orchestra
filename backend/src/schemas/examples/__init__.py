try:
    from fastapi.openapi.models import Example
except ImportError:
    Example = dict


class Examples:
    PROJECT_EXAMPLES = {
        "enso_labs": Example(
            summary="Enso Labs Project",
            description="This is a project example for the Enso Labs project",
            value={
                "name": "Enso Labs",
                "description": "This is a project example for the Enso Labs project",
                "metadata": {},
            },
        ),
    }
    SOURCE_EXAMPLES = {
        # "gitbook": Example(
        #     summary="Gitbook Source",
        #     description="This is a source example for the Gitbook project",
        #     value=[{
        #         "type": "gitbook",
        #         "metadata": {
        #             "urls": ["https://github.com/ruska-ai/a2a-langgraph"],
        #             "load_all_paths": True,
        #         },
        #     }],
        # ),
        "web_scrape": Example(
            summary="A2A LangGraph Source",
            description="This is a source example for the A2A LangGraph project",
            value=[
                {
                    "type": "web_scrape",
                    "content": {
                        "urls": ["https://github.com/ruska-ai/a2a-langgraph"],
                    },
                }
            ],
        ),
        "base64": Example(
            summary="Base64 Source",
            description="This is a source example for the Base64 project",
            value=[
                {
                    "type": "base64",
                    "content": {
                        "data": ["data:text/plain;base64,SGVsbG8sIFdvcmxkIQ=="],
                    },
                }
            ],
        ),
    }
