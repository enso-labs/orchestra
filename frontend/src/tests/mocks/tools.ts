export const mockTools = {
	tools: [
		{
			id: "available_tools",
			description: "List all available tools.",
			args: {},
		},
		{
			id: "shell_local",
			description:
				"Run a shell commands. Commands is a list of strings, each representing a command to run. Avoid interactive commands.",
			args: {
				commands: {
					items: {
						type: "string",
					},
					title: "Commands",
					type: "array",
				},
			},
		},
		{
			id: "shell_docker",
			description:
				"Run shell commands in a Docker container. Accepts multiple commands as a list of strings. \n    Each command is executed sequentially inside the specified container. Avoid interactive commands.",
			args: {
				commands: {
					items: {
						type: "string",
					},
					title: "Commands",
					type: "array",
				},
			},
		},
		{
			id: "retrieval_query",
			description:
				"Query the vector store. Search type can be 'mmr' or 'similarity'. Search kwargs is a dictionary of kwargs for the search type.",
			args: {
				query: {
					title: "Query",
					type: "string",
				},
				search_type: {
					default: "similarity",
					title: "Search Type",
					type: "string",
				},
				search_kwargs: {
					default: {
						k: 10,
					},
					title: "Search Kwargs",
					type: "object",
				},
			},
		},
		{
			id: "retrieval_add",
			description:
				'Add documents to the vector store.\n\n    Example:\n\n        .. code-block:: python\n\n            from langchain_core.documents import Document\n\n            document = Document(\n                page_content="Hello, world!",\n                metadata={"source": "https://example.com"}\n            )',
			args: {
				docs: {
					items: {
						$ref: "#/$defs/Document",
					},
					title: "Docs",
					type: "array",
				},
			},
		},
		{
			id: "retrieval_load",
			description: "Load the vector store from a file.",
			args: {
				path: {
					default: "./sandbox/db/vectorstore.json",
					title: "Path",
					type: "string",
				},
			},
		},
		{
			id: "agent_builder",
			description:
				'Build and run an AI agent with the specified configuration.\n\n    Args:\n        query (str): The user\'s question or request to be processed\n        system (str): System message to set context and instructions for the agent\n        tools (list[str]): List of tool names the agent should have access to\n        thread_id (str): Unique identifier for the conversation thread, if not provided, a new thread will be created\n\n    Returns:\n        Response: JSON response containing the agent\'s answer and thread_id\n\n    Example:\n        .. code-block:: python\n\n            response = agent_builder(\n                thread_id="123e4567-e89b-12d3-a456-426614174000",\n                query="What is the weather today?",\n                system="You are a helpful weather assistant.",\n                tools=["weather_query"]\n            )',
			args: {
				query: {
					title: "Query",
					type: "string",
				},
				system: {
					title: "System",
					type: "string",
				},
				tools: {
					items: {
						type: "string",
					},
					title: "Tools",
					type: "array",
				},
				thread_id: {
					anyOf: [
						{
							type: "string",
						},
						{
							type: "null",
						},
					],
					title: "Thread Id",
				},
			},
		},
		{
			id: "sql_query_read",
			description:
				'Execute a read-only query against a PostgreSQL database based on a natural language question.\n\n    Args:\n        question (str): A natural language question about the data (e.g., "How many users signed up last week?")\n                       The question will be converted to a SELECT query automatically.\n\n    Returns:\n        dict: Response containing:\n            - input: Original question\n            - output: Query results\n            - intermediate_steps: Steps showing question-to-SQL conversion and execution',
			args: {
				question: {
					title: "Question",
					type: "string",
				},
			},
		},
		{
			id: "sql_query_write",
			description:
				'Execute a data modification query against a PostgreSQL database based on a natural language request.\n\n    Args:\n        question (str): A natural language request to modify data (e.g., "Delete all inactive users" or \n                       "Update John\'s email to john@example.com")\n                       The request will be converted to an INSERT, UPDATE, or DELETE query automatically.\n\n    Returns:\n        dict: Response containing:\n            - input: Original question\n            - output: Query results\n            - intermediate_steps: Steps showing question-to-SQL conversion and execution',
			args: {
				question: {
					title: "Question",
					type: "string",
				},
			},
		},
	],
};
