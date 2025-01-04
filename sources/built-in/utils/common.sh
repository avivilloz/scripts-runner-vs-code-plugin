#!/bin/bash

check_parameter() {
    key=$1
    value=$2

    echo "Checking parameter: $key=$value"

    if [ -z "$value" ]; then
        echo "Error: Value for $key is required."
        exit 1
    fi
}

print_separator() {
    title=$1
    echo ""
    echo "------------------------------------------------------------------"
    if [ -n "$title" ]; then
        echo "- $title"
        echo "------------------------------------------------------------------"
    fi
    echo ""
}