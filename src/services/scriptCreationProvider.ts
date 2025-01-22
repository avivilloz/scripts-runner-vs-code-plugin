import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ScriptsSourceService } from './scriptsSourceService';
import { ScriptConfig, ScriptsConfig } from '../models/script';

export class ScriptCreationProvider {
    private panel: vscode.WebviewPanel | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        private scriptsSourceService: ScriptsSourceService,
        private onScriptAdded: () => Promise<void>
    ) { }

    public show() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'scriptCreation',
            'Add New Script',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getWebviewContent();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        this.panel.webview.onDidReceiveMessage(async message => {
            try {
                switch (message.command) {
                    case 'getSources':
                        const sources = this.scriptsSourceService.getAllScriptsPaths();
                        this.panel?.webview.postMessage({
                            command: 'updateSources',
                            sources: sources.map(s => ({
                                name: s.sourceName,
                                path: s.path
                            }))
                        });
                        break;

                    case 'createScript':
                        await this.createScript(message.scriptConfig);
                        vscode.window.showInformationMessage('Script created successfully');
                        await this.onScriptAdded();
                        this.panel?.dispose();
                        break;

                    case 'validatePath':
                        const isValid = await this.validatePath(message.path);
                        this.panel?.webview.postMessage({
                            command: 'pathValidation',
                            isValid,
                            path: message.path
                        });
                        break;
                }
            } catch (error: any) {
                vscode.window.showErrorMessage(`Error: ${error.message}`);
            }
        });
    }

    private async validatePath(targetPath: string): Promise<boolean> {
        try {
            const dir = path.dirname(targetPath);
            await fs.promises.access(dir, fs.constants.W_OK);
            return true;
        } catch {
            return false;
        }
    }

    private async createScript(config: {
        name: string;
        description: string;
        category?: string;
        tags?: string[];
        sourcePath: string;
        platforms: {
            windows?: { type: 'file' | 'inline'; content: string };
            linux?: { type: 'file' | 'inline'; content: string };
            darwin?: { type: 'file' | 'inline'; content: string };
        };
        parameters?: Array<{
            name: string;
            description: string;
            type?: 'text' | 'select' | 'boolean';
            options?: string[];
            default?: string | boolean;
        }>;
        terminal?: {
            new?: boolean;
            onExit?: {
                refresh?: boolean;
                clear?: boolean;
                close?: boolean;
            };
        };
    }) {
        // Create script files if needed
        const createdFiles: string[] = [];
        const scriptFiles: string[] = [];
        const platformScripts: { [key: string]: string[] | string } = {};

        for (const [platform, script] of Object.entries(config.platforms)) {
            if (!script) continue;

            if (script.type === 'file') {
                const fileName = script.content;
                const filePath = path.join(config.sourcePath, fileName);
                const dir = path.dirname(filePath);

                // Create directory if it doesn't exist
                await fs.promises.mkdir(dir, { recursive: true });

                // Create empty file if it doesn't exist
                if (!fs.existsSync(filePath)) {
                    await fs.promises.writeFile(filePath, '', 'utf8');

                    // Set executable permissions on Unix-like systems
                    if (process.platform !== 'win32') {
                        await fs.promises.chmod(filePath, '755');
                    }

                    createdFiles.push(filePath);
                }

                scriptFiles.push(fileName);
                platformScripts[platform] = [fileName];
            } else {
                platformScripts[platform] = script.content;
            }
        }

        // Update or create scripts.json
        const scriptsJsonPath = path.join(config.sourcePath, 'scripts.json');
        let scriptsConfig: ScriptsConfig;

        try {
            const content = await fs.promises.readFile(scriptsJsonPath, 'utf8');
            scriptsConfig = JSON.parse(content);
        } catch {
            scriptsConfig = { scripts: [] };
        }

        const newScript: ScriptConfig = {
            name: config.name,
            description: config.description,
            category: config.category,
            tags: config.tags,
            platforms: platformScripts,
            parameters: config.parameters,
            terminal: config.terminal,
            path: scriptFiles[0] || ''  // Use first script file as main path
        };

        scriptsConfig.scripts.push(newScript);

        // Create scripts.json if it doesn't exist
        await fs.promises.mkdir(path.dirname(scriptsJsonPath), { recursive: true });
        await fs.promises.writeFile(
            scriptsJsonPath,
            JSON.stringify(scriptsConfig, null, 4),
            'utf8'
        );

        // Open all created files in the editor
        for (const filePath of createdFiles) {
            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document, { preview: false });
        }

        // Also open scripts.json if it was created or modified
        const scriptsJsonDoc = await vscode.workspace.openTextDocument(scriptsJsonPath);
        await vscode.window.showTextDocument(scriptsJsonDoc, { preview: false });
    }

    private getWebviewContent() {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Add New Script</title>
            <style>
                body { 
                    padding: 20px;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                }
                .form-group {
                    margin-bottom: 1rem;
                }
                label {
                    display: block;
                    margin-bottom: 0.5rem;
                }
                input, select, textarea {
                    width: 100%;
                    padding: 0.5rem;
                    border: 1px solid var(--vscode-input-border);
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                }
                button {
                    padding: 0.5rem 1rem;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    cursor: pointer;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .platform-group {
                    margin-bottom: 1rem;
                    padding: 1rem;
                    border: 1px solid var(--vscode-input-border);
                }
                .parameter-group {
                    margin-bottom: 1rem;
                    padding: 1rem;
                    border: 1px solid var(--vscode-input-border);
                }
                .remove-btn {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .checkbox-group {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .checkbox-group input[type="checkbox"] {
                    width: auto;
                }
                .error {
                    color: var(--vscode-errorForeground);
                    font-size: 0.9em;
                    margin-top: 0.25rem;
                }
                .tabs {
                    display: flex;
                    margin-bottom: 1rem;
                }
                .tab {
                    padding: 0.5rem 1rem;
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    cursor: pointer;
                    margin-right: 0.5rem;
                }
                .tab.active {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                .tab-content {
                    display: none;
                }
                .tab-content.active {
                    display: block;
                }
            </style>
        </head>
        <body>
            <form id="scriptForm">
                <div class="form-group">
                    <label for="source">Source</label>
                    <select id="source" required>
                        <option value="">Select a source...</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="name">Script Name</label>
                    <input type="text" id="name" required>
                </div>

                <div class="form-group">
                    <label for="description">Description</label>
                    <textarea id="description" rows="3" required></textarea>
                </div>

                <div class="form-group">
                    <label for="category">Category (optional)</label>
                    <input type="text" id="category">
                </div>

                <div class="form-group">
                    <label for="tags">Tags (comma-separated, optional)</label>
                    <input type="text" id="tags" placeholder="tag1, tag2, tag3">
                </div>

                <div class="form-group">
                    <h3>Platforms</h3>
                    <div id="platforms">
                        <div class="platform-group">
                            <h4>Windows</h4>
                            <div class="tabs">
                                <button type="button" class="tab active" data-platform="windows" data-type="file">File</button>
                                <button type="button" class="tab" data-platform="windows" data-type="inline">Inline</button>
                            </div>
                            <div class="tab-content active" data-platform="windows" data-type="file">
                                <input type="text" placeholder="script.ps1" class="script-path">
                            </div>
                            <div class="tab-content" data-platform="windows" data-type="inline">
                                <textarea rows="3" placeholder="Write-Host 'Hello World'" class="script-content"></textarea>
                            </div>
                        </div>

                        <div class="platform-group">
                            <h4>Linux</h4>
                            <div class="tabs">
                                <button type="button" class="tab active" data-platform="linux" data-type="file">File</button>
                                <button type="button" class="tab" data-platform="linux" data-type="inline">Inline</button>
                            </div>
                            <div class="tab-content active" data-platform="linux" data-type="file">
                                <input type="text" placeholder="script.sh" class="script-path">
                            </div>
                            <div class="tab-content" data-platform="linux" data-type="inline">
                                <textarea rows="3" placeholder="echo 'Hello World'" class="script-content"></textarea>
                            </div>
                        </div>

                        <div class="platform-group">
                            <h4>macOS</h4>
                            <div class="tabs">
                                <button type="button" class="tab active" data-platform="darwin" data-type="file">File</button>
                                <button type="button" class="tab" data-platform="darwin" data-type="inline">Inline</button>
                            </div>
                            <div class="tab-content active" data-platform="darwin" data-type="file">
                                <input type="text" placeholder="script.sh" class="script-path">
                            </div>
                            <div class="tab-content" data-platform="darwin" data-type="inline">
                                <textarea rows="3" placeholder="echo 'Hello World'" class="script-content"></textarea>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <h3>Parameters</h3>
                    <div id="parameters"></div>
                    <button type="button" id="addParameter">Add Parameter</button>
                </div>

                <div class="form-group">
                    <h3>Terminal Settings</h3>
                    <div class="checkbox-group">
                        <input type="checkbox" id="newTerminal">
                        <label for="newTerminal">Create New Terminal</label>
                    </div>
                    <h4>On Exit</h4>
                    <div class="checkbox-group">
                        <input type="checkbox" id="refreshOnExit">
                        <label for="refreshOnExit">Refresh</label>
                    </div>
                    <div class="checkbox-group">
                        <input type="checkbox" id="clearOnExit">
                        <label for="clearOnExit">Clear</label>
                    </div>
                    <div class="checkbox-group">
                        <input type="checkbox" id="closeOnExit">
                        <label for="closeOnExit">Close</label>
                    </div>
                </div>

                <button type="submit">Create Script</button>
            </form>

            <script>
                const vscode = acquireVsCodeApi();
                const form = document.getElementById('scriptForm');
                const parametersContainer = document.getElementById('parameters');
                let parameters = [];

                // Request sources when page loads
                vscode.postMessage({ command: 'getSources' });

                // Handle source updates
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'updateSources') {
                        const sourceSelect = document.getElementById('source');
                        message.sources.forEach(source => {
                            const option = document.createElement('option');
                            option.value = source.path;
                            option.textContent = source.name;
                            sourceSelect.appendChild(option);
                        });
                    } else if (message.command === 'pathValidation') {
                        // Handle path validation response
                        const input = document.querySelector(\`input[data-path="\${message.path}"]\`);
                        if (input) {
                            const error = input.nextElementSibling;
                            if (message.isValid) {
                                error?.remove();
                            } else if (!error) {
                                const errorDiv = document.createElement('div');
                                errorDiv.className = 'error';
                                errorDiv.textContent = 'Invalid path';
                                input.parentNode.insertBefore(errorDiv, input.nextSibling);
                            }
                        }
                    }
                });

                // Handle tab switching
                document.querySelectorAll('.tab').forEach(tab => {
                    tab.addEventListener('click', (e) => {
                        e.preventDefault();
                        const platform = tab.dataset.platform;
                        const type = tab.dataset.type;
                        
                        // Update tabs
                        document.querySelectorAll(\`.tab[data-platform="\${platform}"]\`).forEach(t => {
                            t.classList.remove('active');
                        });
                        tab.classList.add('active');
                        
                        // Update content
                        document.querySelectorAll(\`.tab-content[data-platform="\${platform}"]\`).forEach(content => {
                            content.classList.remove('active');
                        });
                        document.querySelector(\`.tab-content[data-platform="\${platform}"][data-type="\${type}"]\`).classList.add('active');
                    });
                });

                // Add parameter
                document.getElementById('addParameter').addEventListener('click', () => {
                    const paramId = Date.now();
                    const paramHtml = \`
                        <div class="parameter-group" data-param-id="\${paramId}">
                            <div class="form-group">
                                <label>Name</label>
                                <input type="text" class="param-name" required>
                            </div>
                            <div class="form-group">
                                <label>Description</label>
                                <input type="text" class="param-description" required>
                            </div>
                            <div class="form-group">
                                <label>Type</label>
                                <select class="param-type">
                                    <option value="text">Text</option>
                                    <option value="select">Select</option>
                                    <option value="boolean">Boolean</option>
                                </select>
                            </div>
                            <div class="form-group param-options" style="display: none;">
                                <label>Options (comma-separated)</label>
                                <input type="text" class="param-options-input" placeholder="option1, option2, option3">
                            </div>
                            <div class="form-group">
                                <label>Default Value</label>
                                <input type="text" class="param-default">
                            </div>
                            <button type="button" class="remove-btn" onclick="removeParameter(\${paramId})">Remove Parameter</button>
                        </div>
                    \`;
                    parametersContainer.insertAdjacentHTML('beforeend', paramHtml);

                    // Add type change handler
                    const newParam = parametersContainer.lastElementChild;
                    const typeSelect = newParam.querySelector('.param-type');
                    const optionsGroup = newParam.querySelector('.param-options');
                    
                    typeSelect.addEventListener('change', () => {
                        optionsGroup.style.display = typeSelect.value === 'select' ? 'block' : 'none';
                    });
                });

                // Remove parameter
                window.removeParameter = (paramId) => {
                    const param = document.querySelector(\`.parameter-group[data-param-id="\${paramId}"]\`);
                    param.remove();
                };

                // Form submission
                form.addEventListener('submit', (e) => {
                    e.preventDefault();

                    // Gather parameters
                    const parameters = Array.from(document.querySelectorAll('.parameter-group')).map(group => {
                        const type = group.querySelector('.param-type').value;
                        const param = {
                            name: group.querySelector('.param-name').value,
                            description: group.querySelector('.param-description').value,
                            type: type
                        };

                        if (type === 'select') {
                            const options = group.querySelector('.param-options-input').value
                                .split(',')
                                .map(opt => opt.trim())
                                .filter(opt => opt);
                            param.options = options;
                        }

                        const defaultValue = group.querySelector('.param-default').value;
                        if (defaultValue) {
                            param.default = type === 'boolean' ? defaultValue === 'true' : defaultValue;
                        }

                        return param;
                    });

                    // Gather platform scripts
                    const platforms = {};
                    ['windows', 'linux', 'darwin'].forEach(platform => {
                        const activeTab = document.querySelector(\`.tab.active[data-platform="\${platform}"]\`);
                        const type = activeTab.dataset.type;
                        const content = document.querySelector(\`.tab-content.active[data-platform="\${platform}"] \${type === 'file' ? '.script-path' : '.script-content'}\`).value;
                        
                        if (content) {
                            platforms[platform] = {
                                type,
                                content
                            };
                        }
                    });

                    // Create script config
                    const scriptConfig = {
                        name: document.getElementById('name').value,
                        description: document.getElementById('description').value,
                        category: document.getElementById('category').value || undefined,
                        tags: document.getElementById('tags').value
                            .split(',')
                            .map(tag => tag.trim())
                            .filter(tag => tag),
                        sourcePath: document.getElementById('source').value,
                        platforms,
                        parameters: parameters.length > 0 ? parameters : undefined,
                        terminal: {
                            new: document.getElementById('newTerminal').checked,
                            onExit: {
                                refresh: document.getElementById('refreshOnExit').checked,
                                clear: document.getElementById('clearOnExit').checked,
                                close: document.getElementById('closeOnExit').checked
                            }
                        }
                    };

                    vscode.postMessage({
                        command: 'createScript',
                        scriptConfig
                    });
                });
            </script>
        </body>
        </html>`;
    }
}