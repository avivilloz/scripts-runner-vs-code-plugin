#!/bin/bash

# ----------------------------- Helper Functions -----------------------------

if [ -z "$SOURCE_PATH" ]; then
    echo "Error: SOURCE_PATH environment variable is not set"
    exit 1
fi

source "$SOURCE_PATH/utils/common.sh"

# ------------------------------- Pre Actions -------------------------------

print_separator "Checking Parameters"
GIT_NAME="${1}"
GIT_EMAIL="${2}"
GIT_SCOPE="${3:-local}"

check_parameter "name" "$GIT_NAME"
check_parameter "email" "$GIT_EMAIL"
check_parameter "scope" "$GIT_SCOPE"

# ------------------------------- Main Script -------------------------------

print_separator "Configuring Git"

SCOPE_FLAG="--local"
if [ "$GIT_SCOPE" = "global" ]; then
    SCOPE_FLAG="--global"
fi

echo "Setting git config with scope: $GIT_SCOPE"
git config $SCOPE_FLAG user.name "$GIT_NAME"
git config $SCOPE_FLAG user.email "$GIT_EMAIL"

echo -e "\nVerifying settings:"
echo "User name: $(git config $SCOPE_FLAG user.name)"
echo "User email: $(git config $SCOPE_FLAG user.email)"

# ------------------------------- Post Actions -------------------------------

print_separator "Git configuration completed successfully"
