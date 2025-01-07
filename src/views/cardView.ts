import * as vscode from 'vscode';
import { Script } from '../models/script';

export class CardView {
    private webviewView: vscode.WebviewView | undefined;
    private disposables: vscode.Disposable[] = [];

    constructor(
        private context: vscode.ExtensionContext,
        private onScriptSelected: (script: Script) => void
    ) {}

    public show(scripts: Script[], webviewView: vscode.WebviewView) {
        // Clean up old handlers
        this.dispose();
        
        this.webviewView = webviewView;
        
        // Add new message handler
        const messageHandler = this.webviewView.webview.onDidReceiveMessage(message => {
            if (message.command === 'executeScript') {
                const script = scripts.find(s => s.path === message.scriptPath);
                if (script) {
                    this.onScriptSelected(script);
                }
            }
        });
        
        this.disposables.push(messageHandler);
        this.updateContent(scripts);
    }

    private updateContent(scripts: Script[]) {
        if (!this.webviewView) return;

        this.webviewView.webview.options = {
            enableScripts: true
        };

        this.webviewView.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        padding: 20px;
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                    }
                    .grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
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
                    // .card-title:hover {
                    //     text-decoration: underline;
                    // }
                    .card-meta {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 12px;
                        margin-right: 100px;
                    }
                    .card-description {
                        font-size: 13px;
                        margin-bottom: 12px;
                    }
                    .card-tags {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 6px;
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
                </style>
            </head>
            <body>
                <div class="grid">
                    ${scripts.map(script => `
                        <div class="card" 
                             onclick="executeScript('${script.path}')"
                             data-tooltip="${this.getTooltipContent(script)}">
                            ${script.metadata.category ? 
                                `<div class="card-category">${script.metadata.category}</div>` : 
                                ''}
                            <div class="card-title">${script.metadata.name}</div>
                            <div class="card-meta">
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
                        </div>
                    `).join('')}
                </div>
                <div id="tooltip" class="tooltip"></div>
                <script>
                    const vscode = acquireVsCodeApi();
                    // const tooltip = document.getElementById('tooltip');
                    // let tooltipTimeout;

                    function executeScript(path) {
                        vscode.postMessage({
                            command: 'executeScript',
                            scriptPath: path
                        });
                    }

                    // document.querySelectorAll('.card').forEach(card => {
                    //     card.addEventListener('mouseover', (e) => {
                    //         clearTimeout(tooltipTimeout);
                    //         tooltipTimeout = setTimeout(() => {
                    //             tooltip.innerHTML = card.dataset.tooltip;
                    //             tooltip.style.display = 'block';
                    //             tooltip.style.left = e.pageX + 10 + 'px';
                    //             tooltip.style.top = e.pageY + 10 + 'px';
                    //         }, 500);
                    //     });

                    //     card.addEventListener('mouseout', () => {
                    //         clearTimeout(tooltipTimeout);
                    //         tooltip.style.display = 'none';
                    //     });
                    // });
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