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