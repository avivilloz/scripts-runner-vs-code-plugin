#!/bin/bash

# Clean up
rm -rf dist/
rm -rf node_modules/
rm -rf out/
rm package-lock.json

# Install dependencies
npm install

# Create output directories
# mkdir -p out/node_modules/@vscode/codicons/dist
# mkdir -p dist/node_modules/@vscode/codicons/dist

# Compile TypeScript
npm run compile

# Verify output
if [ ! -f "out/extension.js" ]; then
    echo "Error: Compilation failed - out/extension.js not found"
    exit 1
fi

echo "Build completed successfully"