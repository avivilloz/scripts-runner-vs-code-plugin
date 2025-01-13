import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Script, ScriptMetadata, ScriptConfig, ScriptsConfig } from '../models/script';
import { InputFormProvider } from './inputFormProvider';

type SupportedPlatform = 'windows' | 'linux' | 'darwin';

export class ScriptService {
    private platform: SupportedPlatform;
    private inputFormProvider: InputFormProvider;
    private activeTerminal: vscode.Terminal | null = null;

    constructor(context: vscode.ExtensionContext) {
        const currentPlatform = os.platform();
        // Map platform to supported types or default to 'linux'
        this.platform = (currentPlatform === 'win32' ? 'windows' :
            currentPlatform === 'darwin' ? 'darwin' :
                currentPlatform === 'linux' ? 'linux' : 'linux') as SupportedPlatform;
        this.inputFormProvider = new InputFormProvider(context);
    }

    async findScripts(scriptsSources: Array<{ path: string; sourceName: string; sourcePath: string }>): Promise<Script[]> {
        console.log('Starting script search in sources:', scriptsSources);
        const allScripts: Script[] = [];

        for (const source of scriptsSources) {
            if (!fs.existsSync(source.path)) {
                console.error('Scripts path does not exist:', source.path);
                continue;
            }

            const scriptsJsonPath = path.join(source.path, 'scripts.json');
            if (!fs.existsSync(scriptsJsonPath)) {
                console.error('scripts.json not found in:', source.path);
                continue;
            }

            try {
                const content = await fs.promises.readFile(scriptsJsonPath, 'utf-8');
                const config: ScriptsConfig = JSON.parse(content);

                for (const scriptConfig of config.scripts) {
                    const script = await this.loadScriptFromConfig(
                        scriptConfig,
                        source.path,
                        source.sourceName,
                        source.sourcePath
                    );
                    if (script) {
                        allScripts.push(script);
                    }
                }
            } catch (error) {
                console.error('Error loading scripts.json from:', source.path, error);
            }
        }

        console.log('Found total scripts:', allScripts.length);
        return allScripts;
    }

    private async loadScriptFromConfig(
        config: ScriptConfig,
        basePath: string,
        sourceName: string,
        sourcePath: string
    ): Promise<Script | null> {
        console.log('Loading script config:', config.name);
        const platformScript = config.platforms[this.platform];
        if (!platformScript) {
            console.log(`Script ${config.name} not supported on platform ${this.platform}`);
            return null;
        }

        let scriptPath: string | undefined = undefined;
        let inlineScript: string | undefined = undefined;

        if (typeof platformScript === 'string') {
            inlineScript = platformScript;
            // For inline scripts, use the scripts.json directory as the path
            scriptPath = basePath;
        } else if (Array.isArray(platformScript) && platformScript.length > 0) {
            // Use the first script path directly
            scriptPath = path.join(basePath, platformScript[0]);
            console.log('Checking script path:', scriptPath);
            if (!await fs.promises.access(scriptPath).then(() => true, () => false)) {
                console.error(`Script file not found: ${scriptPath}`);
                return null;
            }
        } else {
            console.error(`Invalid platform script configuration for ${config.name}`);
            return null;
        }

        return {
            metadata: {
                name: config.name,
                description: config.description,
                category: config.category,
                tags: config.tags,
                platforms: config.platforms,
                parameters: config.parameters,
                terminal: config.terminal
            },
            path: scriptPath,
            sourceName,
            sourcePath,
            inlineScript
        };
    }

    private getScriptCommand(scriptPath: string | null, params: string[], exitCommand: string, script?: Script, inlineScript?: string): string {
        if (inlineScript) {
            // Replace parameter placeholders with actual values
            let command = inlineScript;
            params.forEach((value, index) => {
                const param = script?.metadata.parameters?.[index];
                if (param) {
                    command = command.replace(new RegExp(`{${param.name}}`, 'g'), value);
                }
            });
            return `${command}${exitCommand}`;
        }

        // Handle regular file-based scripts
        if (!scriptPath) {
            throw new Error('No script path provided for file-based script');
        }

        const config = vscode.workspace.getConfiguration('scriptsRunner');
        const patterns = config.get<Array<{ pattern: string; command: string }>>('fileExtensions', []);

        // Find first matching pattern
        const matchingPattern = patterns.find(p => {
            const regex = this.patternToRegex(p.pattern);
            return regex.test(path.basename(scriptPath));
        });

        if (!matchingPattern) {
            throw new Error(`No command configured for file: ${scriptPath}`);
        }

        return `${matchingPattern.command} "${scriptPath}" ${params.join(' ')}${exitCommand}`;
    }

    private patternToRegex(pattern: string): RegExp {
        // Convert glob pattern to regex
        const escaped = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
            .replace(/\*/g, '.*')                  // Convert * to .*
            .replace(/\?/g, '.');                  // Convert ? to .
        return new RegExp(`^${escaped}$`);
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

    async executeScript(script: Script): Promise<void> {
        console.log('Executing script:', script.metadata.name);

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
                const paramValues = await this.inputFormProvider.showParameterInputForm(
                    script.metadata.parameters,
                    script.metadata.name,
                    script.metadata.description,
                    script.path
                );

                if (!paramValues) {
                    if (terminalSettings.new) {
                        terminal.dispose();
                    }
                    return;
                }

                for (const param of script.metadata.parameters) {
                    const value = paramValues.get(param.name);
                    if (value || param.default !== undefined) {
                        const defaultValue = typeof param.default === 'boolean'
                            ? param.default.toString()
                            : param.default;
                        params.push(this.quoteParameter(value || defaultValue || ''));
                    }
                }
            }

            const isWindows = this.platform === 'windows';
            let exitCommands = [];

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
                '; ' + exitCommands.join('; ') : '';

            const scriptCommand = this.getScriptCommand(
                script.path,
                params,
                exitCommand,
                script,
                script.inlineScript
            );

            // Prepare environment variables
            const env: Record<string, string> = {
                SOURCE_PATH: script.sourcePath,
            };

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

            const command = `${envSetup} ${scriptCommand}`;

            terminal.show();
            terminal.sendText(command);

            if (terminalSettings.onExit?.close) {
                await new Promise(resolve => setTimeout(resolve, 500));
                if (terminalSettings.new) {
                    terminal.dispose();
                    this.activeTerminal = null;
                }
            }
        } catch (error: unknown) {
            if (terminalSettings.new) {
                terminal.dispose();
                this.activeTerminal = null;
            }
            // Properly show error to user
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Failed to execute script: ${error.message}`);
            }
            throw error;
        }
    }
}
