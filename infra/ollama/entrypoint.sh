#!/bin/bash

echo "Starting Ollama server..."
ollama serve &

echo "Waiting for Ollama server to be active..."
while [ "$(ollama list | grep 'NAME')" == "" ]; do
  sleep 1
done

# Pull the Llama 3.2 Vision model
echo "Pulling Llama 3.2 Vision model..."
ollama pull llama3.2-vision

## Embeddings
echo "Pulling Nomic Embeddings model..."
ollama pull nomic-embed-text

# Keep the container running
touch /var/log/ollama.log
tail -f /var/log/ollama.log