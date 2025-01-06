#!/bin/bash

# ----------------------------- Helper Functions -----------------------------

if [ -z "$SOURCE_PATH" ]; then
    echo "Error: SOURCE_PATH environment variable is not set"
    exit 1
fi

source "$SOURCE_PATH/utils/common.sh"

# ------------------------------- Pre Actions -------------------------------

print_separator "Checking Parameters"
MODE="${1:-all}"
MESSAGE="${2:-updating repository}"
NEW_BRANCH="${3:-none}"
check_parameter "MODE" "$MODE"
check_parameter "MESSAGE" "$MESSAGE"

# ------------------------------- Main Script -------------------------------

print_separator "Starting Git Push"

if [ "$NEW_BRANCH" != "none" ]; then
    echo "Creating new branch: $NEW_BRANCH"
    if ! git checkout -b "$NEW_BRANCH"; then
        echo "Failed to create new branch"
        exit 1
    fi
fi

if [ "$MODE" = "all" ]; then
    echo "Adding all files..."
    git add .
elif [ "$MODE" = "tracked" ]; then
    echo "Adding only tracked files..."
    git add -u
else
    echo "Invalid mode: $MODE"
    exit 1
fi

echo "Committing with message: $MESSAGE"
git commit -m "$MESSAGE" || echo "No changes to commit or commit failed"

echo "Pushing to remote..."
# Get current branch name
CURRENT_BRANCH=$(git symbolic-ref --short HEAD)
# Check if branch has upstream
if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
    git push
else
    echo "No upstream branch set. Setting upstream to origin/$CURRENT_BRANCH..."
    git push --set-upstream origin "$CURRENT_BRANCH"
fi

# ------------------------------- Post Actions -------------------------------

print_separator "Git Push completed successfully"
