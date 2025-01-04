#!/bin/bash

# ----------------------------- Helper Functions -----------------------------

if [ -z "$SOURCE_PATH" ]; then
    echo "Error: SOURCE_PATH environment variable is not set"
    exit 1
fi

source "$SOURCE_PATH/utils/common.sh"

# ------------------------------- Pre Actions -------------------------------

print_separator "Checking Parameters"

ALIAS="${1}"
HOSTNAME="${2}"
USERNAME="${3}"
IS_WSL="${4:-false}"              # parameter with default value
WINDOWS_USERNAME="${5:-Username}" # optional parameter

check_parameter ALIAS $ALIAS
check_parameter HOSTNAME $HOSTNAME
check_parameter USERNAME $USERNAME
check_parameter IS_WSL $IS_WSL
check_parameter WINDOWS_USERNAME $WINDOWS_USERNAME

SSH_DIR=~/.ssh
SSH_DIR_TILDE="~/.ssh"
SSH_CONFIG_FILE="$SSH_DIR/config"
IDENTITY_FILE="$SSH_DIR/$ALIAS"
IDENTITY_FILE_TILDE="$SSH_DIR_TILDE/$ALIAS"
AUTHORIZED_KEYS_FILE="$SSH_DIR_TILDE/authorized_keys"

# ------------------------------- Main Script -------------------------------

print_separator "Creating $SSH_DIR if it doesn't exist"

mkdir -p $SSH_DIR
chmod 700 $SSH_DIR
echo "SSH directory created"

print_separator "Generating SSH Key"

if ! ssh-keygen -t ed25519 -f "$IDENTITY_FILE" -N ""; then
    echo "Failed to generate SSH key"
    exit 1
fi

chmod 400 $IDENTITY_FILE

print_separator "Adding SSH configuration to $SSH_CONFIG_FILE"

echo "
Host $ALIAS
    User $USERNAME
    HostName $HOSTNAME
    PreferredAuthentications publickey
    IdentityFile $IDENTITY_FILE_TILDE" >>$SSH_CONFIG_FILE

chmod 600 $SSH_CONFIG_FILE

echo "SSH configuration completed"

if [ "$IS_WSL" = "true" ]; then
    print_separator "Copying SSH key to Windows"

    WINDOWS_HOME="/mnt/c/Users/$WINDOWS_USERNAME"
    WINDOWS_SSH_DIR="$WINDOWS_HOME/.ssh"

    if [ ! -d "$WINDOWS_HOME" ]; then
        echo "Error: Windows user directory not found: $WINDOWS_HOME"
        exit 1
    fi

    rm -rf $WINDOWS_SSH_DIR
    cp -r ~/.ssh $WINDOWS_HOME

    echo "SSH key copied to Windows"
fi

# ------------------------------- Post Actions -------------------------------

print_separator "SSH key generated successfully"

echo "Copy and paste this public SSH key to your remote host $AUTHORIZED_KEYS_FILE:"
echo ""
cat "$IDENTITY_FILE.pub"
echo ""
