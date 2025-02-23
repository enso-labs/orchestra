# LangGraph FastAPI Starter - Prompt Engineers AI 🤖

LangGraph FastAPI Starter is a Python-based chatbot application that utilizes the LangGraph and LangChain libraries to process and respond to user inputs. The bot is designed to handle conversational flows and can be configured to use different language models.

# Project Documentation

This project includes tools for running shell commands and Docker container operations. For detailed information, please refer to the following documentation:

- [Tools Documentation](./docs/tools/tools.md)
- [Deploy to DigitalOcean](./docs/deploy/digitalocean.md)
- [Human-In-The-Loop](https://langchain-ai.github.io/langgraph/how-tos/create-react-agent-hitl/#usage)
- [Configuring gcalcli](https://github.com/insanum/gcalcli/blob/HEAD/docs/api-auth.md)
- [Issues Logging into gcalcli](https://github.com/insanum/gcalcli/issues/808)

## Prerequisites

- Python 3.10 or higher
- Access to OpenAI API (for GPT-4o model) or Anthropic API (for Claude 3.5 Sonnet)

## Installation (Locally)

1. **Clone the repository:**

   ```bash
   git clone https://github.com/ryaneggz/langgraph-template.git
   cd langgraph-template
   ```

2. **Set up a virtual environment using virutalenv:**

   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows use `.venv\Scripts\activate`
   ```

3. **Install the dependencies:**

   ```bash
   pip install -r requirements.txt
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

## Deployment

## Database Migrations

This project uses Alembic for database migrations. Here's how to work with migrations:

### Initial Setup

1. Create the database (if not exists):

```bash
cd backend
alembic upgrade head
```

```bash
python -m seeds.user_seeder
```

2. Create new

```bash
alembic revision -m "description_of_changes"
```

``bash
### Appliy Next
alembic upgrade +1

### Speicif revision
alembic upgrade <revis_id>

### Appliy Down
alembic downgrade -1

### Appliy Down
alembic downgrade <revis_id>

### History
alembic history
```
