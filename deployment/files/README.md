# Graph Agent Template 🤖

LangGraph Bot is a Python-based chatbot application that utilizes the LangGraph and LangChain libraries to process and respond to user inputs. The bot is designed to handle conversational flows and can be configured to use different language models.

# Project Documentation

This project includes tools for running shell commands and Docker container operations. For detailed information, please refer to the following documentation:

- [Tools Documentation](./docs/tools.md)
- [Docker Compose Configuration](./docs/docker-compose.md)
- [Human-In-The-Loop](https://langchain-ai.github.io/langgraph/how-tos/create-react-agent-hitl/#usage)

## Prerequisites

- Python 3.10 or higher
- Access to OpenAI API (for GPT-4o model) or Anthropic API (for Claude 3.5 Sonnet)

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/ryaneggz/langgraph-template.git
   cd langgraph-template
   ```

2. **Set up a virtual environment using virutalenv:**

   ```bash
   uv venv
   source .venv/bin/activate  # On Windows use `.venv\Scripts\activate`
   ```

3. **Install the dependencies:**

   ```bash
   uv sync
   ```

## Configuration

1. **Environment Variables:**

   Create a `.env` file in the root directory and add your API key(s):

   ```bash
   cp .example.env .env
   ```

   Ensure that your `.env` file is not tracked by git by checking the `.gitignore`:

## Usage

**Run the application:**

   To start the chatbot, run the following command:

   ```bash
   python main.py
   ```

**Test API response:**

   Run the following bash script to test the api

   ```bash
   curl -X 'POST' \
   'http://localhost:8000/llm' \
   -H 'accept: application/json' \
   -H 'Content-Type: application/json' \
   -d '{
      "query": "What is the capital of France?",
      "thread_id": 42,
      "tools": []
   }'
   ```