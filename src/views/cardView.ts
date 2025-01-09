import * as vscode from 'vscode';
import { Script } from '../models/script';
import * as fs from 'fs';

export class CardView {
    private webviewView: vscode.WebviewView | undefined;
    private disposables: vscode.Disposable[] = [];

    constructor(
        private context: vscode.ExtensionContext,
        private onScriptSelected: (script: Script) => void,
        private scriptsProvider: any
    ) {}

    public show(scripts: Script[], webviewView: vscode.WebviewView) {
        // Clean up old handlers
        this.dispose();
        
        this.webviewView = webviewView;
        
        // Add new message handler
        const messageHandler = this.webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'executeScript':
                    const script = scripts.find(s => s.path === message.scriptPath);
                    if (script) {
                        this.onScriptSelected(script);
                    }
                    break;
                case 'togglePin':
                    const scriptToToggle = scripts.find(s => s.path === message.scriptPath);
                    if (scriptToToggle) {
                        this.scriptsProvider.togglePin(scriptToToggle);
                    }
                    break;
                case 'openScript':
                    vscode.workspace.openTextDocument(message.scriptPath)
                        .then(doc => vscode.window.showTextDocument(doc));
                    break;
                default:
                    console.error(`Unknown command: ${message.command}`);
            }
        });
        
        this.disposables.push(messageHandler);
        this.updateContent(scripts);
    }

    private updateContent(scripts: Script[]) {
        if (!this.webviewView) return;

        // Update webview options to allow access to extension resources
        this.webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode/codicons'),
                vscode.Uri.joinPath(this.context.extensionUri, 'out', 'node_modules', '@vscode/codicons'),
                vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'node_modules', '@vscode/codicons')
            ]
        };

        // Try multiple possible paths for the codicon font
        let codiconFontPath = vscode.Uri.joinPath(
            this.context.extensionUri,
            'node_modules',
            '@vscode/codicons',
            'dist',
            'codicon.ttf'
        );

        // If the direct path doesn't exist, try the out directory
        if (!fs.existsSync(codiconFontPath.fsPath)) {
            codiconFontPath = vscode.Uri.joinPath(
                this.context.extensionUri,
                'out',
                'node_modules',
                '@vscode/codicons',
                'dist',
                'codicon.ttf'
            );
        }

        // If that doesn't exist, try the dist directory
        if (!fs.existsSync(codiconFontPath.fsPath)) {
            codiconFontPath = vscode.Uri.joinPath(
                this.context.extensionUri,
                'dist',
                'node_modules',
                '@vscode/codicons',
                'dist',
                'codicon.ttf'
            );
        }

        const fontUri = this.webviewView.webview.asWebviewUri(codiconFontPath);

        // Add specific codicon classes for the icons we're using
        const codiconCss = `
            .codicon-source-control:before { content: "\\ea68"; }
            .codicon-link:before { content: "\\eb15"; }
            .codicon-pinned-empty:before { content: "\\eba0"; }
            .codicon-pinned-full:before { content: "\\EBB2"; }
        `;

        // Add favorite button styles
        const styles = `
            @font-face {
                font-family: "codicon";
                src: url("${fontUri}") format("truetype");
                font-weight: normal;
                font-style: normal;
            }
            .codicon {
                font: normal normal normal 16px/1 codicon;
                display: inline-block;
                text-decoration: none;
                text-rendering: auto;
                text-align: center;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                user-select: none;
                -webkit-user-select: none;
                -ms-user-select: none;
            }
            .pin-btn {
                position: absolute;
                bottom: 12px;
                right: 12px;
                background: none;
                border: none;
                padding: 4px;
                cursor: pointer;
                color: var(--vscode-descriptionForeground);
                opacity: 0.6;
                z-index: 10;
            }
            .pin-btn .codicon {
                font-size: 22px !important;
            }
            .pin-btn:hover {
                opacity: 1;
            }
            .pin-btn.active {
                color: var(--vscode-textLink-activeForeground);
                opacity: 1;
            }
            .card-title {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .link-btn {
                background: none;
                top: 2px;
                border: none;
                padding: 4px;
                cursor: pointer;
                color: var(--vscode-descriptionForeground);
                opacity: 0.7;
                margin-left: 4px;
                border-radius: 4px;
                transition: all 0.2s;
                display: inline-flex;
                align-items: center;
                position: relative;
                z-index: 2;
                pointer-events: all;
            }
            .link-btn:hover {
                opacity: 1;
            }
            .link-btn .codicon {
                font-size: 18px;
                pointer-events: none;
            }
            .card > * {
                pointer-events: auto;
            }
        `;

        this.webviewView.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    ${styles}
                    ${codiconCss}
                    body {
                        padding: 20px;
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                    }
                    .grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
                        gap: 20px;
                    }
                    .card {
                        position: relative;
                        background: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-focusBorder);
                        border-radius: 6px;
                        padding: 16px;
                        cursor: pointer;
                        transition: transform 0.2s;
                        display: flex;
                        flex-direction: column;
                        min-height: 160px;
                        user-select: none;
                        -webkit-user-select: none;
                    }
                    .card:hover {
                        transform: translateY(-2px);
                        border-color: var(--vscode-focusBorder);
                    }
                    .card-title {
                        font-size: 18px;
                        font-weight: 600;
                        margin-bottom: 12px;
                        color: var(--vscode-textLink-foreground);
                    }
                    .card-meta {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 12px;
                        margin-right: 100px;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }
                    .meta-icon {
                        display: inline-flex;
                        align-items: center;
                        opacity: 0.8;
                    }
                    .card-description {
                        font-size: 13px;
                        margin-bottom: 12px;
                        flex: 1;
                    }
                    .card-tags {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 6px;
                        margin-top: auto;
                    }
                    .tag {
                        border: 1px solid var(--vscode-focusBorder);
                        background: transparent;
                        color: var(--vscode-foreground);
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-size: 11px;
                    }
                    .tooltip {
                        position: absolute;
                        background: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-input-border);
                        padding: 8px;
                        border-radius: 4px;
                        z-index: 1000;
                        max-width: 300px;
                        display: none;
                    }
                    .card-category {
                        position: absolute;
                        top: 12px;
                        right: 12px;
                        font-size: 12px;
                        color: black !important;
                        font-weight: 500;
                        background: var(--vscode-badge-background);
                        padding: 2px 8px;
                        border-radius: 4px;
                    }
                    .card > * {
                        pointer-events: none;
                    }
                    .pin-btn {
                        pointer-events: all;
                        position: absolute;
                        bottom: 12px;
                        right: 12px;
                        background: none;
                        border: none;
                        padding: 4px;
                        cursor: pointer;
                        color: var(--vscode-descriptionForeground);
                        opacity: 0.6;
                        z-index: 10;
                        user-select: none;
                        -webkit-user-select: none;
                    }
                </style>
            </head>
            <body>
                <div class="grid">
                    ${scripts.map(script => `
                        <div class="card" 
                             data-script-path="${script.path}">
                            <div class="card-title">
                                ${script.metadata.name}
                                <button class="link-btn" 
                                        data-script-path="${script.path}"
                                        onclick="handleLinkClick(event)">
                                    <i class="codicon codicon-link"></i>
                                </button>
                            </div>
                            ${script.metadata.category ? 
                                `<div class="card-category">${script.metadata.category}</div>` : 
                                ''}
                            <div class="card-meta">
                                <i class="codicon codicon-source-control"></i>
                                ${script.sourceName}
                            </div>
                            <div class="card-description">
                                ${script.metadata.description}
                            </div>
                            ${script.metadata.tags ? `
                                <div class="card-tags">
                                    ${script.metadata.tags.map(tag => `
                                        <span class="tag">${tag}</span>
                                    `).join('')}
                                </div>
                            ` : ''}
                            <button class="pin-btn ${this.scriptsProvider.isPinned(script) ? 'active' : ''}" 
                                    data-script-path="${script.path}"
                                    onclick="handlePinClick(event)">
                                <i class="codicon ${this.scriptsProvider.isPinned(script) ? 'codicon-pinned-full' : 'codicon-pinned-empty'}"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
                <div id="tooltip" class="tooltip"></div>
                <script>
                    const vscode = acquireVsCodeApi();

                    function handlePinClick(event) {
                        event.preventDefault();
                        event.stopPropagation();
                        
                        const button = event.target.closest('.pin-btn');
                        const scriptPath = button.dataset.scriptPath;
                        
                        console.log('Pin clicked:', scriptPath);
                        vscode.postMessage({
                            command: 'togglePin',
                            scriptPath: scriptPath
                        });
                    }

                    function handleLinkClick(event) {
                        console.log('Link click handler called');
                        console.log('Event target:', event.target);
                        event.preventDefault();
                        event.stopPropagation();
                        
                        const button = event.target.closest('.link-btn');
                        console.log('Found button:', button);
                        if (!button) {
                            console.log('No link button found in hierarchy');
                            return;
                        }
                        
                        const scriptPath = button.dataset.scriptPath;
                        console.log('Script path:', scriptPath);
                        
                        vscode.postMessage({
                            command: 'openScript',
                            scriptPath: scriptPath
                        });
                    }

                    // Update the card click handler to also log events
                    document.querySelectorAll('.card').forEach(card => {
                        card.addEventListener('click', (event) => {
                            console.log('Card clicked, target:', event.target);
                            console.log('Is pin button?', !!event.target.closest('.pin-btn'));
                            console.log('Is link button?', !!event.target.closest('.link-btn'));
                            
                            // Only handle clicks if they're not on the pin button or link button
                            if (!event.target.closest('.pin-btn') && !event.target.closest('.link-btn')) {
                                const scriptPath = card.dataset.scriptPath;
                                console.log('Executing script:', scriptPath);
                                vscode.postMessage({
                                    command: 'executeScript',
                                    scriptPath: scriptPath
                                });
                            } else {
                                console.log('Click was on a button, not executing script');
                            }
                        });
                    });
                </script>
            </body>
            </html>
        `;
    }

    private getTooltipContent(script: Script): string {
        let content = `<h3>${script.metadata.name}</h3>`;
        content += `<p>${script.metadata.description}</p>`;
        
        if (script.metadata.parameters?.length) {
            content += '<h4>Parameters:</h4><ul>';
            script.metadata.parameters.forEach(param => {
                const defaultValue = param.default !== undefined ? 
                    ` (default: ${param.default})` : '';
                content += `<li><b>${param.name}</b>: ${param.description}${defaultValue}</li>`;
            });
            content += '</ul>';
        }

        return content.replace(/"/g, '&quot;');
    }

    public dispose() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.webviewView = undefined;
    }
} 