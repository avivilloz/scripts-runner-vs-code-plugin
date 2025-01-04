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
check_parameter "MODE" "$MODE"
check_parameter "MESSAGE" "$MESSAGE"

# ------------------------------- Main Script -------------------------------

print_separator "Starting Git Push"

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
if ! git commit -m "$MESSAGE"; then
    echo "No changes to commit or commit failed"
    exit 1
fi

echo "Pushing to remote..."
if ! git push; then
    echo "Push failed"
    exit 1
fi

# ------------------------------- Post Actions -------------------------------

print_separator "Git Push completed successfully"
