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
            const results = await this.findScriptsRecursively(source.path, source.sourceName, source.sourcePath);
            allScripts.push(...results);
        }

        console.log('Found total scripts:', allScripts.length);
        return allScripts;
    }

    private async findScriptsRecursively(dir: string, sourceName: string, sourcePath: string): Promise<Script[]> {
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
                    const script = await this.loadScriptFromMetadata(filePath, metadataPath, sourceName, sourcePath);
                    if (script) scripts.push(script);
                }
                // Recursively check subdirectories
                const subDirScripts = await this.findScriptsRecursively(filePath, sourceName, sourcePath);
                scripts.push(...subDirScripts);
            }
        }

        return scripts;
    }

    private getScriptCommand(scriptPath: string | null, params: string[], exitCommand: string, script?: Script, inlineScript?: string): string {
        if (inlineScript) {
            // Replace parameter placeholders with actual values
            let command = inlineScript;
            params.forEach((value, index) => {
                const param = script?.metadata.parameters?.[index];
                if (param) {
                    // Use simpler {paramName} syntax
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
        const extensions = config.get<Array<{ extension: string; system: string; command: string }>>('fileExtensions', []);

        const fileExt = path.extname(scriptPath);
        const extensionConfig = extensions.find(
            e => e.extension === fileExt && e.system === this.platform
        );

        if (!extensionConfig) {
            throw new Error(`No command configured for ${fileExt} files on ${this.platform}`);
        }

        return `${extensionConfig.command} "${scriptPath}" ${params.join(' ')}${exitCommand}`;
    }

    private async loadScriptFromMetadata(scriptDir: string, metadataPath: string, sourceName: string, sourcePath: string): Promise<Script | null> {
        console.log('Loading metadata from:', metadataPath);
        try {
            const content = await fs.promises.readFile(metadataPath, 'utf-8');
            const metadata: ScriptMetadata = JSON.parse(content);

            const platformScript = metadata.platforms[this.platform];
            if (!platformScript) {
                console.log(`Script not supported on platform ${this.platform}`);
                return null;
            }

            // Handle both inline and file-based scripts
            let scriptPath: string | undefined = undefined;
            let inlineScript: string | undefined = undefined;

            if (typeof platformScript === 'string') {
                inlineScript = platformScript;
            } else if (Array.isArray(platformScript) && platformScript.length > 0) {
                scriptPath = path.join(scriptDir, platformScript[0]);
                if (!await fs.promises.access(scriptPath).then(() => true, () => false)) {
                    return null;
                }
            } else {
                return null;
            }

            if (!metadata.name || !metadata.description) {
                console.error(`Invalid metadata in ${metadataPath}: missing name or description`);
                return null;
            }

            return {
                metadata,
                path: scriptPath || metadataPath, // Use metadata path for inline scripts
                sourceName,
                sourcePath,
                inlineScript // Add this new property
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
