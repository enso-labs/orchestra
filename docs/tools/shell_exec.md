# shell_exec
The `shell_exec` is a function that allows running shell commands. It accepts a list of strings, where each string represents a command to be executed.

### Parameters
- `commands`: A list of strings, each representing a shell command to be executed.

### Usage
```python
from langchain_core.tools import tool
from langchain_core.tools import ToolException

from src.constants import UserTokenKey
from src.utils.logger import logger

@tool
async def shell_exec(commands: list[str]):
    """Run shell commands in a remote server. Accepts multiple commands as a list of strings. 
    Each command is executed sequentially inside the specified container. Avoid interactive commands."""
    import requests
    
    # Run the commands sequentially
    outputs = []
    
    user_repo = shell_exec.metadata['user_repo']
    url = await user_repo.get_token(key=UserTokenKey.SHELL_EXEC_SERVER_URL.name)
    if not url:
        raise ToolException("SHELL_EXEC_SERVER_URL is not set, see user settings.")
    
    for command in commands:
        try:
            response = requests.post(url, json={"cmd": command})
            output = response.text
            outputs.append(output)
            logger.debug(output)
        except ToolException as e:
            logger.error(f"Error executing command: {command}")
            outputs.append(f"Error executing command: {command} Error: {e}")
    
    return outputs  # Return the output of all commands
```

# Docker Compose Configuration
The project uses Docker Compose to manage the containerized environment. Below is the configuration:

```yaml
version: "3"
services:
  exec_server:
    build:
      context: ./docker/ubuntu
      dockerfile: Dockerfile
    container_name: exec_server
    ports:
      - "3005:3005"
    volumes:
      - ${HOME}/.ssh:/root/.ssh:ro
```

File: `./docker/ubuntu/Dockerfile`

```Dockerfile
# Use Ubuntu 24.04 as the base image
FROM ubuntu:24.04

# Install required packages
RUN apt-get update && apt-get install -y \
    curl \
    tmux \
    nano \
    git \
    jq \
    build-essential

# Set NVM_DIR environment variable
ENV NVM_DIR=/root/.nvm

# Install nvm and Node LTS version
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash && \
    bash -c "source $NVM_DIR/nvm.sh && nvm install --lts && nvm alias default node"

# (Optional) Append Node’s bin directory to the PATH in .profile
RUN bash -c "source $NVM_DIR/nvm.sh && nvm use default && \
    echo 'export PATH=$NVM_DIR/versions/node/$(nvm version default)/bin:$PATH' >> /root/.profile"

# Create working directory for the app
WORKDIR /app

# Clone the repository
RUN git clone https://github.com/promptengineers-ai/exec-server.git

# Copy the entrypoint script into the image
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Expose the server port if necessary
EXPOSE 3005

# Use the entrypoint script to start the container
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
```

File: `./docker/ubuntu/entrypoint.sh`

```sh
#!/bin/bash
# Ensure the nvm environment is loaded
source /root/.nvm/nvm.sh

# Navigate to your app directory
cd /app/exec-server

# Install dependencies (if not already installed)
npm install

# Start your server in a detached tmux session
tmux new-session -d -s exec_server "node index.js"

# Optionally, keep the container running.
# This could be done by tailing a file or by attaching to the tmux session.
echo "Starting exec-server in tmux session..."

tail -f /dev/null
```


This configuration sets up an Ubuntu 24.04 container named "exec_server" that runs continuously, allowing for command execution using the `shell_exec`.
