# Scripts Runner for VS Code

A Visual Studio Code extension that allows you to run PowerShell and Shell scripts from a git repository with parameter support.

## Features

- 🔄 Sync scripts from a Git repository
- 📁 Organize scripts by categories
- 🏷️ Tag-based filtering
- 🔍 Search functionality
- ⚙️ Parameter support with input forms
- 🖥️ Terminal integration
- 💻 Cross-platform support: PowerShell for Windows, Bash for Linux/MacOS

## Installation

1. Open VS Code
2. Press `Ctrl+P` (Windows/Linux) or `Cmd+P` (macOS)
3. Type `ext install scripts-runner`
4. Click Install

## Configuration

Configure the extension through VS Code settings:

```json
{
    "scriptsRunner.repositoryUrl": "https://github.com/username/scripts-repo.git",
    "scriptsRunner.branch": "main",  // Optional: defaults to repository's default branch
    "scriptsRunner.scriptsPath": "scripts"  // Optional: defaults to "scripts"
}
```

## Script Structure

Scripts must be organized in the following structure:

```
scripts/
  ├── category1/
  │   ├── script1/
  │   │   ├── script.json
  │   │   ├── script.sh
  │   │   └── script.ps1
  │   └── script2/
  │       ├── script.json
  │       └── script.sh
  └── category2/
      └── script3/
          ├── script.json
          └── script.ps1
```

### Script Metadata (script.json)

Each script must have a `script.json` file defining its metadata:

```json
{
    "name": "My Script",
    "description": "Performs an important task",
    "category": "Utilities",
    "tags": ["network", "system"],
    "platforms": {
        "windows": ["script.ps1"],
        "linux": ["script.sh"],
        "darwin": ["script.sh"]
    },
    "parameters": [
        {
            "name": "host",
            "description": "Target hostname",
            "required": true
        },
        {
            "name": "port",
            "description": "Port number",
            "default": "8080"
        }
    ],
    "terminal": {
        "useCurrent": false,
        "closeOnExit": true
    }
}
```

## Usage

1. Open the Scripts Runner sidebar (click the Scripts Runner icon in the activity bar)
2. Click the refresh button to sync scripts from the repository
3. Browse available scripts by category or use the search/filter functions
4. Click a script to run it
5. If the script has parameters, fill in the form and click "Run Script"

## Features

### Terminal Integration

Scripts can be configured to:
- Use the current terminal or create a new one
- Close the terminal after execution
- Support different scripts for Windows (PowerShell) and Unix (Bash)

### Parameter Support

- Interactive forms for script parameters
- Required and optional parameters
- Default values
- Parameter descriptions
- Input validation

### Supported Script Types

- Windows: PowerShell scripts (.ps1)
- Linux/MacOS: Shell scripts (.sh)

## Notes

- On Windows, scripts will run using PowerShell
- On Linux/MacOS, scripts will run using Bash
- The extension automatically detects your platform and runs the appropriate script version

## Support

For bugs, questions, and discussions please use the [GitHub Issues](https://github.com/yourusername/scripts-runner-vs-code-plugin/issues).

## License

[MIT](LICENSE)
