#!/bin/bash

npm install -g @vscode/vsce
vsce package
vsce publish
