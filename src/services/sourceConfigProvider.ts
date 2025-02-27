import * as vscode from 'vscode';
import { ConfigurationTarget } from 'vscode';
import { getGlobalConfiguration, updateGlobalConfiguration } from '../utils/configUtils';
import simpleGit from 'simple-git';
import fs from 'fs';

export class SourceConfigProvider {
    public static readonly viewType = 'scriptsRunner.configureSource';

    private panel: vscode.WebviewPanel | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        private onSourceAdded: () => Promise<void>  // Add callback for refresh
    ) { }

    public show() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            SourceConfigProvider.viewType,
            'Configure Scripts Source',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getWebviewContent();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        }, null);

        this.panel.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'addSource':
                    try {
                        await this.addSource(message.source);
                    } catch (error) {
                        // Error already handled in addSource
                    }
                    break;
                case 'browseLocalPath':
                    const uri = await vscode.window.showOpenDialog({
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                        title: 'Select Scripts Directory'
                    });
                    if (uri && uri[0]) {
                        this.panel?.webview.postMessage({
                            command: 'setLocalPath',
                            path: uri[0].fsPath
                        });
                    }
                    break;
                case 'removeSource':
                    try {
                        await this.removeSource(message.name);
                        vscode.window.showInformationMessage('Source removed successfully');
                    } catch (error) {
                        vscode.window.showErrorMessage('Failed to remove source');
                    }
                    break;
                case 'toggleSource':
                    try {
                        await this.toggleSource(message.name, message.enabled);
                        vscode.window.showInformationMessage(
                            `Source ${message.enabled ? 'enabled' : 'disabled'} successfully`
                        );
                    } catch (error) {
                        vscode.window.showErrorMessage('Failed to update source');
                    }
                    break;
            }
        });
    }

    private async toggleSource(name: string, enabled: boolean): Promise<void> {
        const config = vscode.workspace.getConfiguration('scriptsRunner');
        const sources = config.get<any[]>('sources', []);
        const updatedSources = sources.map(source =>
            source.name === name ? { ...source, enabled } : source
        );
        await config.update('sources', updatedSources, ConfigurationTarget.Global);
        this.panel?.webview.postMessage({
            command: 'updateSources',
            sources: updatedSources
        });
        await this.onSourceAdded(); // Refresh scripts list
    }

    private getWebviewContent() {
        const config = vscode.workspace.getConfiguration('scriptsRunner');
        const sources = config.get<any[]>('sources', []);
        const sourcesJson = JSON.stringify(sources);

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Scripts Sources</title>
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
                input, select {
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
                .hidden {
                    display: none;
                }
                #browseButton {
                    margin-top: 0.5rem;
                }
                .sources-list {
                    margin-bottom: 2rem;
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                }
                .source-item {
                    padding: 0.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid var(--vscode-input-border);
                }
                .source-item:last-child {
                    border-bottom: none;
                }
                .source-info {
                    flex: 1;
                }
                .source-name {
                    font-weight: bold;
                }
                .source-detail {
                    font-size: 0.9em;
                    color: var(--vscode-descriptionForeground);
                }
                .add-new-button {
                    margin-bottom: 1rem;
                }
                .form-container {
                    display: none;
                }
                .form-container.visible {
                    display: block;
                }
                .section-title {
                    font-size: 1.2em;
                    font-weight: bold;
                    margin-bottom: 1rem;
                    color: var(--vscode-foreground);
                }
                .source-actions {
                    display: flex;
                    gap: 0.5rem;
                }
                .source-item.disabled {
                    opacity: 0.6;
                }
                .toggle-btn {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .built-in {
                    background: var(--vscode-editor-inactiveSelectionBackground);
                }
                .built-in-badge {
                    font-size: 0.8em;
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 2px 6px;
                    border-radius: 3px;
                    margin-left: 8px;
                    vertical-align: middle;
                }
            </style>
        </head>
        <body>
            <div class="section-title">Configured Sources</div>
            <div class="sources-list" id="sourcesList"></div>
            
            <button type="button" id="addNewBtn" class="add-new-button">Add New Source</button>

            <div id="formContainer" class="form-container">
                <form id="sourceForm">
                    <div class="form-group">
                        <label for="sourceType">Source Type</label>
                        <select id="sourceType" required>
                            <option value="git">Git Repository</option>
                            <option value="local">Local Path</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="name">Display Name</label>
                        <input type="text" id="name" placeholder="My Scripts" required>
                    </div>

                    <div id="gitFields">
                        <div class="form-group">
                            <label for="url">Repository URL</label>
                            <input type="text" id="url" placeholder="https://github.com/user/repo.git">
                        </div>

                        <div class="form-group">
                            <label for="branch">Branch (optional)</label>
                            <input type="text" id="branch" placeholder="main">
                        </div>

                        <div class="form-group">
                            <label for="scriptsPath">Scripts Path (optional)</label>
                            <input type="text" id="scriptsPath" placeholder="scripts">
                        </div>
                    </div>

                    <div id="localFields" class="hidden">
                        <div class="form-group">
                            <label for="path">Local Path</label>
                            <input type="text" id="path" placeholder="/path/to/scripts" readonly>
                            <button type="button" id="browseButton">Browse...</button>
                        </div>
                    </div>

                    <button type="submit">Add Source</button>
                </form>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const sources = ${sourcesJson};
                const sourcesList = document.getElementById('sourcesList');
                const formContainer = document.getElementById('formContainer');
                const addNewBtn = document.getElementById('addNewBtn');
                const form = document.getElementById('sourceForm');
                const sourceType = document.getElementById('sourceType');
                const gitFields = document.getElementById('gitFields');
                const localFields = document.getElementById('localFields');
                const browseButton = document.getElementById('browseButton');

                // Display existing sources
                function renderSources() {
                    sourcesList.innerHTML = sources.map(source => {
                        const details = source.type === 'git' 
                            ? \`Git: \${source.url}\${source.branch ? \` (\${source.branch})\` : ''}\`
                            : \`Local: \${source.path}\`;
                        const enabled = source.enabled !== false;
                        const isBuiltIn = source.builtIn === true;
                        
                        return \`
                            <div class="source-item \${!enabled ? 'disabled' : ''} \${isBuiltIn ? 'built-in' : ''}">
                                <div class="source-info">
                                    <div class="source-name">
                                        \${source.name}
                                        \${isBuiltIn ? '<span class="built-in-badge">Built-in</span>' : ''}
                                    </div>
                                    <div class="source-detail">\${details}</div>
                                </div>
                                <div class="source-actions">
                                    <button type="button" onclick="toggleSource('\${source.name}', \${!enabled})" class="toggle-btn">
                                        \${enabled ? 'Disable' : 'Enable'}
                                    </button>
                                    \${!isBuiltIn ? \`
                                        <button type="button" onclick="removeSource('\${source.name}')" class="delete-btn">
                                            Remove
                                        </button>
                                    \` : ''}
                                </div>
                            </div>
                        \`;
                    }).join('') || '<div class="source-item">No sources configured</div>';
                }

                // Show/hide form
                addNewBtn.addEventListener('click', () => {
                    formContainer.classList.toggle('visible');
                    addNewBtn.textContent = formContainer.classList.contains('visible') 
                        ? 'Cancel' 
                        : 'Add New Source';
                });

                // Remove source
                window.removeSource = (sourceName) => {
                    vscode.postMessage({ 
                        command: 'removeSource',
                        name: sourceName
                    });
                };

                // Handle existing form submission
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const source = {
                        type: sourceType.value,
                        name: document.getElementById('name').value
                    };

                    if (sourceType.value === 'git') {
                        source.url = document.getElementById('url').value;
                        const branch = document.getElementById('branch').value;
                        const scriptsPath = document.getElementById('scriptsPath').value;
                        if (branch) source.branch = branch;
                        if (scriptsPath) source.scriptsPath = scriptsPath;
                    } else {
                        source.path = document.getElementById('path').value;
                    }

                    vscode.postMessage({ command: 'addSource', source });
                    
                    // Clear the form instead of hiding it
                    form.reset();
                    // Reset source type related fields visibility
                    if (sourceType.value === 'git') {
                        gitFields.classList.remove('hidden');
                        localFields.classList.add('hidden');
                    } else {
                        gitFields.classList.add('hidden');
                        localFields.classList.remove('hidden');
                    }
                });

                // Initial render
                renderSources();

                // Listen for updates from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'updateSources':
                            sources.length = 0;
                            sources.push(...message.sources);
                            renderSources();
                            break;
                        case 'setLocalPath':
                            document.getElementById('path').value = message.path;
                            break;
                    }
                });

                sourceType.addEventListener('change', () => {
                    if (sourceType.value === 'git') {
                        gitFields.classList.remove('hidden');
                        localFields.classList.add('hidden');
                    } else {
                        gitFields.classList.add('hidden');
                        localFields.classList.remove('hidden');
                    }
                });

                browseButton.addEventListener('click', () => {
                    vscode.postMessage({ command: 'browseLocalPath' });
                });

                // Add toggle source function to window
                window.toggleSource = (sourceName, enable) => {
                    vscode.postMessage({ 
                        command: 'toggleSource',
                        name: sourceName,
                        enabled: enable
                    });
                };
            </script>
        </body>
        </html>`;
    }

    // Add method to handle source removal
    private async removeSource(name: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('scriptsRunner');
        const sources = config.get<any[]>('sources', []);
        const updatedSources = sources.filter(source => source.name !== name);
        await config.update('sources', updatedSources, ConfigurationTarget.Global);
        this.panel?.webview.postMessage({
            command: 'updateSources',
            sources: updatedSources
        });
        await this.onSourceAdded(); // Refresh scripts list
    }

    private async updateConfig(sources: any[]): Promise<void> {
        await updateGlobalConfiguration('sources', sources);
    }

    private async validateSource(source: any): Promise<void> {
        if (source.type === 'git') {
            try {
                const git = simpleGit();
                await git.listRemote([source.url]);
            } catch (error: unknown) {
                throw new Error(`Failed to access git repository: ${(error as Error).message}`);
            }
        } else if (source.type === 'local') {
            if (!fs.existsSync(source.path)) {
                throw new Error(`Local path does not exist: ${source.path}`);
            }
            try {
                await fs.promises.access(source.path, fs.constants.R_OK);
            } catch (error: unknown) {
                throw new Error(`Cannot access local path: ${(error as Error).message}`);
            }
        }
    }

    private async addSource(source: any): Promise<void> {
        try {
            // Validate source before adding
            await this.validateSource(source);

            // If validation passes, add to settings
            const sources = getGlobalConfiguration<any[]>('sources', []);
            sources.push(source);
            await updateGlobalConfiguration('sources', sources);
            
            await this.onSourceAdded();
            this.panel?.webview.postMessage({
                command: 'updateSources',
                sources: sources
            });
            vscode.window.showInformationMessage('Source added successfully');
        } catch (error: any) {
            // Show specific error message
            vscode.window.showErrorMessage(`Failed to add source: ${error.message}`);
            throw error; // Re-throw to prevent UI updates
        }
    }
}
