import * as vscode from 'vscode';

export interface FileExtensionConfig {
    extension: string;
    system: 'windows' | 'linux' | 'darwin';
    command: string;
    builtIn?: boolean;
}

export class FileExtensionConfigProvider {
    public static readonly viewType = 'scriptsRunner.configureFileExtensions';
    private panel: vscode.WebviewPanel | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        private onConfigurationChanged: () => Promise<void>
    ) { }

    public show() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            FileExtensionConfigProvider.viewType,
            'Configure File Extensions',
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
            const config = vscode.workspace.getConfiguration('scriptsRunner');
            const extensions = config.get<FileExtensionConfig[]>('fileExtensions', []);

            switch (message.command) {
                case 'saveExtension':
                    try {
                        let existingIndex = -1;

                        if (message.originalValues) {
                            // Find the original extension configuration
                            existingIndex = extensions.findIndex(
                                e => e.extension === message.originalValues.extension &&
                                    e.system === message.originalValues.system
                            );
                        } else {
                            // For new extensions, check if it already exists
                            existingIndex = extensions.findIndex(
                                e => e.extension === message.config.extension &&
                                    e.system === message.config.system
                            );
                        }

                        if (existingIndex >= 0) {
                            extensions[existingIndex] = message.config;
                        } else {
                            extensions.push(message.config);
                        }

                        await config.update('fileExtensions', extensions, true);
                        await this.onConfigurationChanged();

                        this.panel?.webview.postMessage({
                            command: 'updateExtensions',
                            extensions: extensions
                        });

                        vscode.window.showInformationMessage('File extension configuration saved');
                    } catch (error) {
                        vscode.window.showErrorMessage('Failed to save file extension configuration');
                    }
                    break;

                case 'removeExtension':
                    try {
                        const updatedExtensions = extensions.filter(
                            e => !(e.extension === message.extension &&
                                e.system === message.system)
                        );

                        await config.update('fileExtensions', updatedExtensions, true);
                        await this.onConfigurationChanged();

                        this.panel?.webview.postMessage({
                            command: 'updateExtensions',
                            extensions: updatedExtensions
                        });

                        vscode.window.showInformationMessage('File extension configuration removed');
                    } catch (error) {
                        vscode.window.showErrorMessage('Failed to remove file extension configuration');
                    }
                    break;
            }
        });
    }

    private getWebviewContent() {
        const config = vscode.workspace.getConfiguration('scriptsRunner');
        const extensions = config.get<FileExtensionConfig[]>('fileExtensions', []);
        const extensionsJson = JSON.stringify(extensions);

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>File Extensions Configuration</title>
            <style>
                body { 
                    padding: 20px;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                }
                .extension-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px;
                    margin-bottom: 8px;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-input-border);
                }
                .extension-item.built-in {
                    background: var(--vscode-editor-inactiveSelectionBackground);
                }
                .extension-item input, .extension-item select {
                    padding: 4px 8px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                }
                .extension-item input:disabled, .extension-item select:disabled {
                    opacity: 0.7;
                    background: var(--vscode-input-background);
                }
                button {
                    padding: 4px 8px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    cursor: pointer;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                button.secondary {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .add-new {
                    margin-top: 16px;
                }
                .built-in-badge {
                    font-size: 0.8em;
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 2px 6px;
                    border-radius: 3px;
                }
                .section-title {
                    font-size: 1.2em;
                    margin-bottom: 16px;
                }
            </style>
        </head>
        <body>
            <div class="section-title">File Extension Commands</div>
            <div id="extensionsList"></div>
            <button id="addNewBtn" class="add-new">Add New Extension</button>

            <script>
                const vscode = acquireVsCodeApi();
                const extensions = ${extensionsJson};
                const extensionsList = document.getElementById('extensionsList');
                const addNewBtn = document.getElementById('addNewBtn');

                function createExtensionItem(config = null, isNew = false) {
                    const item = document.createElement('div');
                    item.className = 'extension-item' + (config?.builtIn ? ' built-in' : '');
                    
                    const extensionInput = document.createElement('input');
                    extensionInput.placeholder = '.ext';
                    extensionInput.style.width = '80px';
                    extensionInput.value = config?.extension || '';
                    extensionInput.disabled = !isNew && !config?.editing;
                    
                    const systemSelect = document.createElement('select');
                    systemSelect.innerHTML = \`
                        <option value="windows">Windows</option>
                        <option value="linux">Linux</option>
                        <option value="darwin">macOS</option>
                    \`;
                    systemSelect.value = config?.system || 'windows';
                    systemSelect.disabled = !isNew && !config?.editing;
                    
                    const commandInput = document.createElement('input');
                    commandInput.placeholder = 'Command';
                    commandInput.style.width = '200px';
                    commandInput.value = config?.command || '';
                    commandInput.disabled = !isNew && !config?.editing;

                    const saveBtn = document.createElement('button');
                    saveBtn.textContent = 'Save';
                    saveBtn.style.display = isNew || config?.editing ? 'block' : 'none';
                    
                    const editBtn = document.createElement('button');
                    editBtn.textContent = 'Edit';
                    editBtn.className = 'secondary';
                    editBtn.style.display = !isNew && !config?.editing ? 'block' : 'none';
                    
                    const removeBtn = document.createElement('button');
                    removeBtn.textContent = 'Remove';
                    removeBtn.className = 'secondary';
                    removeBtn.style.display = !config?.builtIn ? 'block' : 'none';

                    if (config?.builtIn) {
                        const builtInBadge = document.createElement('span');
                        builtInBadge.className = 'built-in-badge';
                        builtInBadge.textContent = 'Built-in';
                        item.appendChild(builtInBadge);
                    }

                    item.appendChild(extensionInput);
                    item.appendChild(systemSelect);
                    item.appendChild(commandInput);
                    item.appendChild(saveBtn);
                    item.appendChild(editBtn);
                    item.appendChild(removeBtn);

                    saveBtn.addEventListener('click', () => {
                        if (!extensionInput.value || !commandInput.value) {
                            vscode.postMessage({ 
                                command: 'showError',
                                message: 'All fields are required'
                            });
                            return;
                        }

                        const newConfig = {
                            extension: extensionInput.value,
                            system: systemSelect.value,
                            command: commandInput.value,
                            builtIn: config?.builtIn || false
                        };

                        vscode.postMessage({ 
                            command: 'saveExtension',
                            config: newConfig,
                            originalValues: isNew ? null : {
                                extension: config.extension,
                                system: config.system
                            }
                        });

                        if (isNew) {
                            item.remove();
                        } else {
                            extensionInput.disabled = true;
                            systemSelect.disabled = true;
                            commandInput.disabled = true;
                            saveBtn.style.display = 'none';
                            editBtn.style.display = 'block';
                        }
                    });

                    editBtn.addEventListener('click', () => {
                        extensionInput.disabled = false;
                        systemSelect.disabled = false;
                        commandInput.disabled = false;
                        saveBtn.style.display = 'block';
                        editBtn.style.display = 'none';
                    });

                    removeBtn.addEventListener('click', () => {
                        vscode.postMessage({ 
                            command: 'removeExtension',
                            extension: extensionInput.value,
                            system: systemSelect.value
                        });
                        item.remove();
                    });

                    return item;
                }

                function renderExtensions() {
                    extensionsList.innerHTML = '';
                    extensions.forEach(config => {
                        extensionsList.appendChild(createExtensionItem(config));
                    });
                }

                addNewBtn.addEventListener('click', () => {
                    extensionsList.appendChild(createExtensionItem(null, true));
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'updateExtensions':
                            extensions.length = 0;
                            extensions.push(...message.extensions);
                            renderExtensions();
                            break;
                    }
                });

                // Initial render AFTER event listener is set up
                renderExtensions();
            </script>
        </body>
        </html>`;
    }
}
