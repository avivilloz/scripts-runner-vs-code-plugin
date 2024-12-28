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

    async findScripts(scriptsPath: string): Promise<Script[]> {
        console.log('Starting script search in:', scriptsPath);
        if (!fs.existsSync(scriptsPath)) {
            console.error('Scripts path does not exist:', scriptsPath);
            return [];
        }
        const results = await this.findScriptsRecursively(scriptsPath);
        console.log('Found scripts:', results);
        return results;
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

        if (settings?.useCurrent) {
            // Make sure the active terminal exists and is visible
            if (vscode.window.activeTerminal) {
                console.log('Using existing active terminal:', vscode.window.activeTerminal.name);
                vscode.window.activeTerminal.show(true); // true = preserve focus
                return vscode.window.activeTerminal;
            }

            // If there's any terminal, use the first one
            if (vscode.window.terminals.length > 0) {
                const terminal = vscode.window.terminals[0];
                console.log('No active terminal, using first available:', terminal.name);
                terminal.show(true);
                return terminal;
            }

            console.log('No existing terminals found, creating new one');
        } else {
            console.log('useCurrent is false, creating new terminal');
        }

        // Create new terminal if requested or if no existing terminals
        const terminal = vscode.window.createTerminal(scriptName);
        console.log('Created new terminal:', terminal.name);
        terminal.show(true);
        return terminal;
    }

    async executeScript(script: Script): Promise<void> {
        console.log('Executing script:', script.metadata.name);
        console.log('Terminal settings:', script.metadata.terminal);

        // Set default terminal settings if none provided
        const terminalSettings: ScriptMetadata['terminal'] = {
            useCurrent: false,
            ...script.metadata.terminal
        };

        const terminal = this.getTerminal(terminalSettings, script.metadata.name);

        try {
            const params: string[] = [];

            if (script.metadata.parameters) {
                const paramValues = await this.inputFormProvider.showParameterInputForm(script.metadata.parameters);

                if (!paramValues) {
                    if (!terminalSettings.useCurrent) {
                        terminal.dispose();
                    }
                    return;
                }

                for (const param of script.metadata.parameters) {
                    const value = paramValues.get(param.name);
                    if (param.required && !value) {
                        throw new Error(`Required parameter ${param.name} not provided`);
                    }

                    if (value || param.default) {
                        params.push(this.quoteParameter(value || param.default || ''));
                    }
                }
            }

            // Build command based on script type
            let command = '';
            const closeCommand = terminalSettings.closeOnExit ? ' && exit' : '';

            // On Windows, we need a different approach for closing PowerShell
            const isPowershell = path.extname(script.path) === '.ps1';
            const exitCommand = isPowershell ?
                (terminalSettings.closeOnExit ? '; exit' : '') :
                (terminalSettings.closeOnExit ? ' && exit' : '');

            switch (path.extname(script.path)) {
                case '.sh':
                    command = `bash "${script.path}" ${params.join(' ')}${exitCommand}`;
                    break;
                case '.bat':
                    command = `"${script.path}" ${params.join(' ')}${exitCommand}`;
                    break;
                case '.ps1':
                    command = `powershell -File "${script.path}" ${params.join(' ')}${exitCommand}`;
                    break;
                case '.py':
                    command = `python "${script.path}" ${params.join(' ')}${exitCommand}`;
                    break;
            }

            terminal.show();
            terminal.sendText(command);

            if (terminalSettings.closeOnExit) {
                await new Promise(resolve => setTimeout(resolve, 500));

                if (!terminalSettings.useCurrent) {
                    terminal.dispose();
                    this.activeTerminal = null;
                }
            }
        } catch (error: unknown) {
            if (!terminalSettings.useCurrent) {
                terminal.dispose();
                this.activeTerminal = null;
            }
            throw error;
        }
    }
}
