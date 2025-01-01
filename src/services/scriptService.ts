import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Script, ScriptMetadata } from '../models/script';
import { InputFormProvider } from './inputFormProvider';

type SupportedPlatform = 'windows' | 'linux' | 'darwin';

export class ScriptService {
    private platform: SupportedPlatform;
    private inputFormProvider: InputFormProvider;
    private activeTerminal: vscode.Terminal | null = null;

    constructor() {
        const currentPlatform = os.platform();
        // Map platform to supported types or default to 'linux'
        this.platform = (currentPlatform === 'win32' ? 'windows' :
            currentPlatform === 'darwin' ? 'darwin' :
                currentPlatform === 'linux' ? 'linux' : 'linux') as SupportedPlatform;
        this.inputFormProvider = new InputFormProvider();
    }

    async findScripts(scriptsPaths: string[]): Promise<Script[]> {
        console.log('Starting script search in paths:', scriptsPaths);
        const allScripts: Script[] = [];

        for (const scriptsPath of scriptsPaths) {
            if (!fs.existsSync(scriptsPath)) {
                console.error('Scripts path does not exist:', scriptsPath);
                continue;
            }
            const results = await this.findScriptsRecursively(scriptsPath);
            allScripts.push(...results);
        }

        console.log('Found total scripts:', allScripts.length);
        return allScripts;
    }

    private async findScriptsRecursively(dir: string): Promise<Script[]> {
        console.log('Searching for scripts in:', dir);
        const scripts: Script[] = [];
        const files = await fs.promises.readdir(dir).catch((err) => {
            console.error('Error reading directory:', dir, err);
            return [];
        });

        console.log('Found files:', files);

        for (const file of files) {
            const filePath = path.join(dir, file);
            console.log('Checking path:', filePath);
            const stats = await fs.promises.stat(filePath);

            if (stats.isDirectory()) {
                const metadataPath = path.join(filePath, 'script.json');
                // Check for script.json in current directory
                if (await fs.promises.access(metadataPath).then(() => true, () => false)) {
                    const script = await this.loadScriptFromMetadata(filePath, metadataPath);
                    if (script) scripts.push(script);
                }
                // Recursively check subdirectories
                const subDirScripts = await this.findScriptsRecursively(filePath);
                scripts.push(...subDirScripts);
            }
        }

        return scripts;
    }

    private async loadScriptFromMetadata(scriptDir: string, metadataPath: string): Promise<Script | null> {
        console.log('Loading metadata from:', metadataPath);
        try {
            const content = await fs.promises.readFile(metadataPath, 'utf-8');
            const metadata: ScriptMetadata = JSON.parse(content);

            if (!metadata.platforms[this.platform]) {
                console.log(`Script not supported on platform ${this.platform}`);
                return null;
            }

            const platformScripts = metadata.platforms[this.platform];
            if (!platformScripts || platformScripts.length === 0) return null;

            const scriptPath = path.join(scriptDir, platformScripts[0]);
            if (!await fs.promises.access(scriptPath).then(() => true, () => false)) return null;

            if (!metadata.name || !metadata.description) {
                console.error(`Invalid metadata in ${metadataPath}: missing name or description`);
                return null;
            }

            return {
                metadata,
                path: scriptPath
            };
        } catch (error: unknown) {
            console.error(`Error loading script metadata from ${metadataPath}:`, error);
            if (error instanceof Error) {
                console.error(error.message);
            }
            return null;
        }
    }

    private quoteParameter(param: string): string {
        // If parameter contains spaces and isn't already quoted, wrap it in quotes
        if (param.includes(' ') && !param.startsWith('"') && !param.startsWith("'")) {
            return `"${param}"`;
        }
        return param;
    }

    private getTerminal(settings: ScriptMetadata['terminal'], scriptName: string): vscode.Terminal {
        console.log('Terminal settings:', settings);
        console.log('Current terminals:', vscode.window.terminals.map(t => t.name));
        console.log('Active terminal:', vscode.window.activeTerminal?.name);

        if (!settings?.new) {
            // Use existing terminal if available
            if (vscode.window.activeTerminal) {
                console.log('Using existing active terminal:', vscode.window.activeTerminal.name);
                vscode.window.activeTerminal.show(true);
                return vscode.window.activeTerminal;
            }

            // If there's any terminal, use the first one
            if (vscode.window.terminals.length > 0) {
                const terminal = vscode.window.terminals[0];
                console.log('No active terminal, using first available:', terminal.name);
                terminal.show(true);
                return terminal;
            }
        }

        // Create new terminal if requested or if no existing terminals
        console.log('Creating new terminal');
        const terminal = vscode.window.createTerminal(scriptName);
        terminal.show(true);
        return terminal;
    }

    private getRepositoryPath(scriptPath: string): string {
        // Walk up the directory tree until we find the repository root (where scripts folder is)
        let currentPath = path.dirname(scriptPath);
        let lastPath = '';

        while (currentPath !== lastPath) {
            // Check if we've reached the scripts-repos directory
            if (path.basename(path.dirname(currentPath)) === 'scripts-repos') {
                return currentPath;
            }
            lastPath = currentPath;
            currentPath = path.dirname(currentPath);
        }
        return currentPath;
    }

    async executeScript(script: Script): Promise<void> {
        console.log('Executing script:', script.metadata.name);
        console.log('Terminal settings:', script.metadata.terminal);

        // Get repository path for environment variable
        const repoPath = this.getRepositoryPath(script.path);
        console.log('Repository path:', repoPath);

        // Set default terminal settings with single onExit definition
        const terminalSettings: ScriptMetadata['terminal'] = {
            new: false,
            onExit: {
                refresh: false,
                clear: false,
                close: false,
                ...script.metadata.terminal?.onExit
            },
            ...script.metadata.terminal
        };

        const terminal = this.getTerminal(terminalSettings, script.metadata.name);

        try {
            const params: string[] = [];

            if (script.metadata.parameters) {
                const paramValues = await this.inputFormProvider.showParameterInputForm(script.metadata.parameters);

                if (!paramValues) {
                    if (terminalSettings.new) {  // Changed from !terminalSettings.useCurrent
                        terminal.dispose();
                    }
                    return;
                }

                for (const param of script.metadata.parameters) {
                    // Get value or default - no need to check if required
                    const value = paramValues.get(param.name);

                    // Always add value since form validation ensures all parameters have values
                    if (value || param.default !== undefined) {
                        // Convert default value to string if it's boolean
                        const defaultValue = typeof param.default === 'boolean'
                            ? param.default.toString()
                            : param.default;
                        params.push(this.quoteParameter(value || defaultValue || ''));
                    }
                }
            }

            // Build command based on script type

            // On Windows, we need a different approach for closing PowerShell
            // const isPowershell = path.extname(script.path) === '.ps1';
            const isWindows = this.platform === 'windows';
            let exitCommands = [];

            // Build exit commands based on settings
            if (terminalSettings.onExit?.refresh) {
                exitCommands.push(isWindows ? 'powershell' : 'bash');
            }
            if (terminalSettings.onExit?.clear) {
                exitCommands.push(isWindows ? 'clear' : 'clear');
            }
            if (terminalSettings.onExit?.close) {
                exitCommands.push(isWindows ? 'exit' : 'exit');
            }

            const exitCommand = exitCommands.length > 0 ?
                (isWindows ? '; ' : ' && ') + exitCommands.join(isWindows ? '; ' : ' && ') :
                '';

            let scriptCommand = '';
            switch (path.extname(script.path)) {
                case '.sh':
                    scriptCommand = `bash "${script.path}" ${params.join(' ')}${exitCommand}`;
                    break;
                case '.ps1':
                    scriptCommand = `powershell -File "${script.path}" ${params.join(' ')}${exitCommand}`;
                    break;
                case '.py':
                    scriptCommand = `python "${script.path}" ${params.join(' ')}${exitCommand}`;
                    break;
            }

            // Prepare environment variables
            const env: Record<string, string> = {
                SCRIPT_PATH: script.path,
                SCRIPTS_REPO_PATH: repoPath,
                // Add more built-in variables as needed
            };

            // Build environment variable export commands
            let envSetup = '';
            if (isWindows) {
                envSetup = Object.entries(env)
                    .map(([key, value]) => `$env:${key}="${value}";`)
                    .join(' ');
            } else {
                envSetup = Object.entries(env)
                    .map(([key, value]) => `export ${key}="${value}";`)
                    .join(' ');
            }

            // Build final command with environment setup
            const command = `${envSetup} ${scriptCommand}`;

            terminal.show();
            terminal.sendText(command);

            if (terminalSettings.onExit?.close) {
                await new Promise(resolve => setTimeout(resolve, 500));
                if (terminalSettings.new) {  // Changed from !terminalSettings.useCurrent
                    terminal.dispose();
                    this.activeTerminal = null;
                }
            }
        } catch (error: unknown) {
            if (terminalSettings.new) {  // Changed from !terminalSettings.useCurrent
                terminal.dispose();
                this.activeTerminal = null;
            }
            throw error;
        }
    }
}
