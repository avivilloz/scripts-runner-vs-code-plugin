import * as vscode from 'vscode';
import { ConfigurationTarget } from 'vscode';

export interface FilePattern {
    pattern: string;
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
            'Configure File Patterns',
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
            const extensions = config.get<FilePattern[]>('fileExtensions', []);

            switch (message.command) {
                case 'saveExtension':
                    try {
                        let existingIndex = -1;

                        if (message.originalValues) {
                            // Find the original extension configuration
                            existingIndex = extensions.findIndex(
                                e => e.pattern === message.originalValues.pattern
                            );
                        } else {
                            // For new extensions, check if it already exists
                            existingIndex = extensions.findIndex(
                                e => e.pattern === message.config.pattern
                            );
                        }

                        if (existingIndex >= 0) {
                            extensions[existingIndex] = message.config;
                        } else {
                            extensions.push(message.config);
                        }

                        await this.updateConfig(extensions);
                        await this.onConfigurationChanged();

                        this.panel?.webview.postMessage({
                            command: 'updateExtensions',
                            extensions: extensions,
                            savedExtension: message.config.pattern,
                            itemId: message.itemId
                        });

                        vscode.window.showInformationMessage('File extension configuration saved');
                    } catch (error) {
                        vscode.window.showErrorMessage('Failed to save file extension configuration');
                    }
                    break;

                case 'removeExtension':
                    try {
                        const updatedExtensions = extensions.filter(
                            e => !(e.pattern === message.pattern)
                        );

                        await this.updateConfig(updatedExtensions);
                        await this.onConfigurationChanged();

                        this.panel?.webview.postMessage({
                            command: 'updateExtensions',
                            extensions: updatedExtensions,
                            removedExtension: message.pattern,
                            itemId: message.itemId
                        });

                        vscode.window.showInformationMessage('File extension configuration removed');
                    } catch (error) {
                        vscode.window.showErrorMessage('Failed to remove file extension configuration');
                    }
                    break;

                case 'saveAllExtensions':
                    try {
                        const updatedExtensions = [...extensions];

                        // Handle updates to existing patterns
                        if (message.updates) {
                            for (const update of message.updates) {
                                const existingIndex = updatedExtensions.findIndex(
                                    e => e.pattern === update.originalPattern
                                );
                                if (existingIndex >= 0) {
                                    updatedExtensions[existingIndex] = update.newConfig;
                                }
                            }
                        }

                        // Handle new patterns
                        if (message.configs) {
                            for (const newConfig of message.configs) {
                                const existingIndex = updatedExtensions.findIndex(
                                    e => e.pattern === newConfig.pattern
                                );
                                if (existingIndex >= 0) {
                                    updatedExtensions[existingIndex] = newConfig;
                                } else {
                                    updatedExtensions.push(newConfig);
                                }
                            }
                        }

                        await this.updateConfig(updatedExtensions);
                        await this.onConfigurationChanged();

                        this.panel?.webview.postMessage({
                            command: 'updateExtensions',
                            extensions: updatedExtensions
                        });

                        vscode.window.showInformationMessage('All file extension configurations saved');
                    } catch (error) {
                        vscode.window.showErrorMessage('Failed to save file extension configurations');
                    }
                    break;

                case 'reorderPatterns':
                    try {
                        // Directly update the configuration with the new order
                        await this.updateConfig(message.patterns);
                        await this.onConfigurationChanged();

                        // Confirm the update to the webview
                        this.panel?.webview.postMessage({
                            command: 'updateExtensions',
                            extensions: message.patterns
                        });
                    } catch (error) {
                        vscode.window.showErrorMessage('Failed to update pattern order');
                    }
                    break;
            }
        });
    }

    private getWebviewContent() {
        const config = vscode.workspace.getConfiguration('scriptsRunner');
        const extensions = config.get<FilePattern[]>('fileExtensions', []);
        const extensionsJson = JSON.stringify(extensions);

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>File Pattern Commands</title>
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
                    cursor: move;
                    position: relative;
                    user-select: none;
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
                .extension-field {
                    width: 80px;
                    flex-shrink: 0;
                }
                .system-field {
                    width: 100px;
                    flex-shrink: 0;
                }
                .command-field {
                    flex: 1;
                    min-width: 200px;
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
                    white-space: nowrap;
                    flex-shrink: 0;
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
                    margin-left: 8px;
                }
                .section-title {
                    font-size: 1.2em;
                    margin-bottom: 16px;
                }
                .general-save {
                    margin-top: 16px;
                    display: none;
                }
                button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .extension-item {
                    cursor: move;
                    position: relative;
                    user-select: none;
                }

                .extension-item.dragging {
                    opacity: 0.5;
                    background: var(--vscode-editor-selectionBackground);
                }

                .extension-item.drag-over {
                    border-top: 2px solid var(--vscode-focusBorder);
                }

                .drag-handle {
                    cursor: move;
                    padding: 0 8px;
                    opacity: 0.6;
                    display: flex;
                    align-items: center;
                }

                .drag-handle:hover {
                    opacity: 1;
                }

                .drag-handle::before {
                    content: "≡";
                    font-size: 20px;
                }
            </style>
        </head>
        <body>
            <div class="section-title">File Pattern Commands</div>
            <div id="extensionsList"></div>
            <button id="addNewBtn" class="add-new-button">Add New Pattern</button>
            <button id="saveAllBtn" class="general-save">Save All Changes</button>

            <script>
                const vscode = acquireVsCodeApi();
                let extensions = ${extensionsJson};
                const extensionsList = document.getElementById('extensionsList');
                const addNewBtn = document.getElementById('addNewBtn');
                const saveAllBtn = document.getElementById('saveAllBtn');
                let editModeCount = 0;
                const editStates = new Map();
                const originalPatterns = new Map();

                function updateSaveAllButton() {
                    console.log('Edit mode count:', editModeCount);
                    saveAllBtn.style.display = editModeCount > 0 ? 'block' : 'none';
                }

                function createExtensionItem(config = null, isNew = false) {
                    const item = document.createElement('div');
                    item.className = 'extension-item' + (config?.builtIn ? ' built-in' : '');
                    item.draggable = !config?.builtIn;
                    
                    const dragHandle = document.createElement('div');
                    dragHandle.className = 'drag-handle';
                    if (!config?.builtIn) {
                        item.appendChild(dragHandle);
                    }

                    const patternInput = document.createElement('input');
                    patternInput.placeholder = 'Pattern';
                    patternInput.className = 'extension-field';
                    patternInput.value = config?.pattern || '';
                    patternInput.disabled = !isNew && !config?.editing;
                    
                    const commandInput = document.createElement('input');
                    commandInput.placeholder = 'Command';
                    commandInput.className = 'command-field';
                    commandInput.value = config?.command || '';
                    commandInput.disabled = !isNew && !config?.editing;

                    const saveBtn = document.createElement('button');
                    saveBtn.textContent = 'Save';
                    saveBtn.type = 'submit';
                    saveBtn.style.display = isNew || config?.editing ? 'block' : 'none';
                    
                    const editBtn = document.createElement('button');
                    editBtn.textContent = 'Edit';
                    editBtn.className = 'secondary';
                    editBtn.style.display = !isNew && !config?.editing ? 'block' : 'none';
                    
                    const removeBtn = document.createElement('button');
                    removeBtn.textContent = 'Remove';
                    removeBtn.className = 'secondary';
                    removeBtn.style.display = !config?.builtIn ? 'block' : 'none';

                    // Generate unique ID for the item
                    const itemId = Date.now().toString() + Math.random();
                    item.dataset.itemId = itemId;

                    if (isNew || config?.editing) {
                        editStates.set(itemId, true);
                        if (!isNew) {
                            originalPatterns.set(itemId, config.pattern);
                        }
                        editModeCount++;
                        updateSaveAllButton();
                    }

                    saveBtn.addEventListener('click', () => {
                        if (!patternInput.value || !commandInput.value) {
                            vscode.postMessage({ 
                                command: 'showError',
                                message: 'All fields are required'
                            });
                            return;
                        }

                        const newConfig = {
                            pattern: patternInput.value,
                            command: commandInput.value,
                            builtIn: config?.builtIn || false
                        };

                        vscode.postMessage({ 
                            command: 'saveExtension',
                            config: newConfig,
                            originalValues: isNew ? null : {
                                pattern: config.pattern
                            },
                            itemId: itemId  // Send the itemId with the save message
                        });
                    });

                    editBtn.addEventListener('click', () => {
                        patternInput.disabled = false;
                        commandInput.disabled = false;
                        saveBtn.style.display = 'block';
                        editBtn.style.display = 'none';
                        editStates.set(itemId, true);
                        originalPatterns.set(itemId, patternInput.value);
                        editModeCount++;
                        updateSaveAllButton();
                    });

                    removeBtn.addEventListener('click', () => {
                        const pattern = patternInput.value;
                        
                        if (isNew && !pattern) {
                            if (editStates.has(itemId)) {
                                editStates.delete(itemId);
                                editModeCount--;
                                updateSaveAllButton();
                            }
                            item.remove();
                            return;
                        }

                        vscode.postMessage({ 
                            command: 'removeExtension',
                            pattern: pattern,
                            itemId: itemId
                        });
                    });

                    item.appendChild(dragHandle);
                    item.appendChild(patternInput);
                    item.appendChild(commandInput);
                    item.appendChild(saveBtn);
                    item.appendChild(editBtn);
                    item.appendChild(removeBtn);

                    // Add drag and drop event listeners
                    if (!config?.builtIn) {
                        item.addEventListener('dragstart', handleDragStart);
                        item.addEventListener('dragend', handleDragEnd);
                        item.addEventListener('dragover', handleDragOver);
                        item.addEventListener('drop', handleDrop);
                    }

                    return item;
                }

                function handleDragStart(e) {
                    draggedItem = e.target;
                    e.target.classList.add('dragging');
                }

                function handleDragEnd(e) {
                    e.target.classList.remove('dragging');
                    draggedItem = null;
                    document.querySelectorAll('.extension-item').forEach(item => {
                        item.classList.remove('drag-over');
                    });
                }

                function handleDragOver(e) {
                    e.preventDefault();
                    const item = e.target.closest('.extension-item');
                    if (item && item !== draggedItem && !item.classList.contains('built-in')) {
                        item.classList.add('drag-over');
                    }
                }

                function handleDrop(e) {
                    e.preventDefault();
                    const dropTarget = e.target.closest('.extension-item');
                    
                    if (dropTarget && draggedItem && dropTarget !== draggedItem && !dropTarget.classList.contains('built-in')) {
                        const allItems = [...extensionsList.children];
                        const draggedIndex = allItems.indexOf(draggedItem);
                        const dropIndex = allItems.indexOf(dropTarget);
                        
                        // Reorder the items in the DOM
                        if (draggedIndex < dropIndex) {
                            dropTarget.parentNode.insertBefore(draggedItem, dropTarget.nextSibling);
                        } else {
                            dropTarget.parentNode.insertBefore(draggedItem, dropTarget);
                        }

                        // Get all current patterns in their new order
                        const newOrder = [];
                        document.querySelectorAll('.extension-item').forEach(item => {
                            const patternInput = item.querySelector('.extension-field');
                            const commandInput = item.querySelector('.command-field');
                            const isBuiltIn = item.classList.contains('built-in');
                            
                            if (patternInput && commandInput) {
                                newOrder.push({
                                    pattern: patternInput.value,
                                    command: commandInput.value,
                                    builtIn: isBuiltIn
                                });
                            }
                        });

                        // Update local state
                        extensions = newOrder;

                        // Send the complete new order to the extension
                        vscode.postMessage({
                            command: 'reorderPatterns',
                            patterns: newOrder
                        });
                    }

                    document.querySelectorAll('.extension-item').forEach(item => {
                        item.classList.remove('drag-over');
                    });
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

                saveAllBtn.addEventListener('click', () => {
                    const items = extensionsList.querySelectorAll('.extension-item');
                    const configs = [];
                    const updates = [];
                    
                    items.forEach(item => {
                        const patternInput = item.querySelector('.extension-field');
                        const commandInput = item.querySelector('.command-field');
                        const itemId = item.dataset.itemId;
                        
                        if (!patternInput.disabled && patternInput.value && commandInput.value) {
                            const config = {
                                pattern: patternInput.value,
                                command: commandInput.value,
                                builtIn: item.classList.contains('built-in')
                            };

                            // If this is an edit of an existing pattern, include the original pattern
                            if (originalPatterns.has(itemId)) {
                                updates.push({
                                    originalPattern: originalPatterns.get(itemId),
                                    newConfig: config
                                });
                            } else {
                                configs.push(config);
                            }
                        }
                    });

                    if (configs.length > 0 || updates.length > 0) {
                        vscode.postMessage({
                            command: 'saveAllExtensions',
                            configs: configs,
                            updates: updates
                        });
                    }
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'updateExtensions':
                            if (message.savedExtension) {
                                // Only update the saved item
                                const items = extensionsList.querySelectorAll('.extension-item');
                                items.forEach(item => {
                                    if (item.dataset.itemId === message.itemId) {
                                        const patternInput = item.querySelector('.extension-field');
                                        const commandInput = item.querySelector('.command-field');
                                        const saveBtn = item.querySelector('button[type="submit"]');
                                        const editBtn = item.querySelector('button.secondary');

                                        patternInput.disabled = true;
                                        commandInput.disabled = true;
                                        saveBtn.style.display = 'none';
                                        editBtn.style.display = 'block';

                                        if (editStates.has(item.dataset.itemId)) {
                                            editStates.delete(item.dataset.itemId);
                                            editModeCount--;
                                            updateSaveAllButton();
                                        }
                                    }
                                });
                                extensions = message.extensions;
                            } else if (message.removedExtension) {
                                const items = extensionsList.querySelectorAll('.extension-item');
                                items.forEach(item => {
                                    if (item.dataset.itemId === message.itemId) {
                                        if (editStates.has(item.dataset.itemId)) {
                                            editStates.delete(item.dataset.itemId);
                                            editModeCount--;
                                            updateSaveAllButton();
                                        }
                                        item.remove();
                                    }
                                });
                                extensions = message.extensions;
                            } else {
                                // For full updates, preserve edit states
                                const currentEditStates = new Map(editStates);
                                extensions = message.extensions;
                                extensionsList.innerHTML = '';
                                extensions.forEach(config => {
                                    const item = createExtensionItem(config);
                                    if (currentEditStates.has(item.dataset.itemId)) {
                                        const inputs = item.querySelectorAll('input');
                                        inputs.forEach(input => input.disabled = false);
                                        item.querySelector('button[type="submit"]').style.display = 'block';
                                        item.querySelector('button.secondary').style.display = 'none';
                                    }
                                    extensionsList.appendChild(item);
                                });
                            }
                            break;
                    }
                });

                renderExtensions();
            </script>
        </body>
        </html>`;
    }

    private async updateConfig(patterns: FilePattern[]): Promise<void> {
        const config = vscode.workspace.getConfiguration('scriptsRunner');
        await config.update('fileExtensions', patterns, ConfigurationTarget.Global);
    }

    private async validatePattern(pattern: FilePattern): Promise<void> {
        try {
            // Basic validation - ensure pattern is not empty
            if (!pattern.pattern.trim()) {
                throw new Error('Pattern cannot be empty');
            }
            // Try creating a regex from the pattern to validate syntax
            this.patternToRegex(pattern.pattern);
        } catch (error: any) {
            throw new Error(`Invalid pattern: ${error.message}`);
        }
    }

    private patternToRegex(pattern: string): RegExp {
        const escaped = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        return new RegExp(`^${escaped}$`);
    }
}
