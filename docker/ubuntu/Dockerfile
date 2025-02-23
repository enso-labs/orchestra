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
