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
                if (await fs.promises.access(metadataPath).then(() => true, () => false)) {
                    const script = await this.loadScriptFromMetadata(filePath, metadataPath);
                    if (script) scripts.push(script);
                }
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

    async executeScript(script: Script): Promise<void> {
        const terminal = vscode.window.createTerminal(script.metadata.name);
        const config = vscode.workspace.getConfiguration('scriptsRunner');
        const keepTerminalOpen = config.get<boolean>('keepTerminalOpen', false);

        try {
            const params: string[] = [];

            if (script.metadata.parameters) {
                const paramValues = await this.inputFormProvider.showParameterInputForm(script.metadata.parameters);

                if (!paramValues) {
                    // User cancelled the input form
                    terminal.dispose();
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
            switch (path.extname(script.path)) {
                case '.sh':
                    command = keepTerminalOpen ?
                        `bash "${script.path}" ${params.join(' ')}` :
                        `bash "${script.path}" ${params.join(' ')} && exit`;
                    break;
                case '.bat':
                    command = keepTerminalOpen ?
                        `"${script.path}" ${params.join(' ')}` :
                        `"${script.path}" ${params.join(' ')} && exit`;
                    break;
                case '.ps1':
                    command = keepTerminalOpen ?
                        `powershell -File "${script.path}" ${params.join(' ')}` :
                        `powershell -File "${script.path}" ${params.join(' ')} ; exit`;
                    break;
                case '.py':
                    command = keepTerminalOpen ?
                        `python "${script.path}" ${params.join(' ')}` :
                        `python "${script.path}" ${params.join(' ')} && exit`;
                    break;
            }

            terminal.show();
            terminal.sendText(command);

            if (!keepTerminalOpen) {
                await new Promise(resolve => setTimeout(resolve, 100));
                terminal.dispose();
            }
        } catch (error: unknown) {
            if (!keepTerminalOpen) {
                terminal.dispose();
            }
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Unknown error occurred while executing script');
        }
    }
}
