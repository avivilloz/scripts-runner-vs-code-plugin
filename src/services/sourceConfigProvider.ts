import * as vscode from 'vscode';

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
                        const config = vscode.workspace.getConfiguration('scriptsRunner');
                        const sources = config.get<any[]>('sources', []);
                        sources.push(message.source);
                        await config.update('sources', sources, true);
                        await this.onSourceAdded();  // Call the refresh callback
                        // Update the webview with new sources
                        this.panel?.webview.postMessage({
                            command: 'updateSources',
                            sources: sources
                        });
                        vscode.window.showInformationMessage('Source added successfully');
                        // Remove: this.panel?.dispose();
                    } catch (error) {
                        vscode.window.showErrorMessage('Failed to add source');
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
            }
        });
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
                        
                        return \`
                            <div class="source-item">
                                <div class="source-info">
                                    <div class="source-name">\${source.name}</div>
                                    <div class="source-detail">\${details}</div>
                                </div>
                                <button type="button" onclick="removeSource('\${source.name}')" class="delete-btn">Remove</button>
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
            </script>
        </body>
        </html>`;
    }

    // Add method to handle source removal
    private async removeSource(name: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('scriptsRunner');
        const sources = config.get<any[]>('sources', []);
        const updatedSources = sources.filter(source => source.name !== name);
        await config.update('sources', updatedSources, true);
        this.panel?.webview.postMessage({
            command: 'updateSources',
            sources: updatedSources
        });
        await this.onSourceAdded(); // Refresh scripts list
    }
}
