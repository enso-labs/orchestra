FROM ubuntu:24.04-slim

# Set up NVM
ENV NVM_DIR=/root/.nvm

# Install base tools, NVM, Node LTS, and clean up in one layer
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl \
      tmux \
      nano \
      git \
      jq \
      build-essential \
 && rm -rf /var/lib/apt/lists/* \
 \
 # Install NVM & Node LTS
 && curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash \
 && . "$NVM_DIR/nvm.sh" \
 && nvm install --lts \
 && nvm alias default node \
 && nvm cache clear

# Ensure node is on PATH
ENV PATH=$NVM_DIR/versions/node/$(nvm version default)/bin:$PATH

# Clone your app (shallow) and set as workdir
WORKDIR /app
RUN git clone --depth 1 https://github.com/promptengineers-ai/exec-server.git .

# Copy & enable entrypoint
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3005
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
