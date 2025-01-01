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

Configure the extension through VS Code settings. You can add multiple repositories with different script locations:

```json
{
    "scriptsRunner.repositories": [
        {
            "name": "Team Scripts",
            "url": "https://github.com/team/scripts.git",
            "branch": "main",
            "scriptsPath": "scripts"
        },
        {
            "name": "Infrastructure Scripts",
            "url": "git@github.com:team/infrastructure.git",
            "branch": "develop",
            "scriptsPath": "automation/scripts"
        },
        {
            "name": "Personal Scripts",
            "url": "https://github.com/user/tools.git",
            "scriptsPath": "powershell-scripts"
        }
    ]
}
```

Each repository configuration supports:
- `name`: Display name for the repository (optional but recommended)
- `url`: Git repository URL (required)
- `branch`: Branch to use (optional, defaults to main/master)
- `scriptsPath`: Path to scripts directory within the repository (optional, defaults to "scripts")

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
            "type": "text"
        },
        {
            "name": "useSSL",
            "description": "Use SSL",
            "default": false,
            "type": "boolean"
        },
        {
            "name": "timeout",
            "description": "Timeout in seconds",
            "type": "select",
            "default": "option2",
            "options": [
                "option1",
                "option2",
                "option3"
            ]
        }
    ],
    "terminal": {
        "new": false,
        "onExit": {
            "refresh": false,
            "clear": false,
            "close": false
        }
    }
}
```

## Usage

1. Open the Scripts Runner sidebar (click the Scripts Runner icon in the activity bar)
2. Click the refresh button to sync scripts from the repository
3. Browse available scripts by category or use the search/filter functions
4. Click a script to run it
5. If the script has parameters, fill in the form and click "Run Script"

### Built-in Environment Variables

Each script automatically receives these environment variables:

- `SCRIPT_PATH`: Full path to the executing script file
- `SCRIPTS_REPO_PATH`: Root path of the repository containing the script

## Features

### Terminal Integration

Scripts can be configured to:
- Use the current terminal or create a new one
- Close the terminal after execution
- Clear the terminal before execution
- Focus the terminal after execution
- Refresh the terminal after execution
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
