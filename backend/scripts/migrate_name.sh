#!/bin/bash

# Check if a migration name was provided
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <migration-name>"
  exit 1
fi

# Store the migration name from the command-line argument
MIGRATION_NAME="$1"

# Generate a timestamp in the format YYYYMMDDHHMMSS
TIMESTAMP=$(date +"%Y%m%d%H%M%S")

# Create the filename by combining the timestamp and migration name
FILE_NAME="${TIMESTAMP}-${MIGRATION_NAME}"

# Create the migration file (an empty file)
touch "$FILE_NAME"

echo "Migration file created: $FILE_NAME"