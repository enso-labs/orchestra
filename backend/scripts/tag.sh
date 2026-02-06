#!/bin/bash

ORIGIN=origin

# Prompt for tag and message
read -p "Enter tag (e.g. 0.0.1-rc1): " tag
read -p "Enter message (press enter for none): " message

# Show details and confirm
echo -e "\nTag details:"
echo "Tag: $tag"
echo "Message: ${message:-<empty>}"

read -p "Proceed with creating and pushing tag? (y/N) " confirm

if [[ $confirm =~ ^[Yy]$ ]]; then
    if git rev-parse "$tag" >/dev/null 2>&1; then
        echo "Tag $tag already exists locally. Delete it first with: git tag -d $tag"
        exit 1
    fi
    if [ -z "$message" ]; then
        git tag -a "$tag" -m ""
    else
        git tag -a "$tag" -m "$message"
    fi

    if git push $ORIGIN "$tag"; then
        echo "Tag created and pushed successfully"
    else
        echo "Push failed. If the tag exists on the remote, overwrite with: git push $ORIGIN $tag --force"
        exit 1
    fi
else
    echo "Operation cancelled"
fi
