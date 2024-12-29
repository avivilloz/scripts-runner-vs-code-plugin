import * as vscode from 'vscode';
import { ParameterMetadata } from '../models/script';

export class InputFormProvider {
    async showParameterInputForm(parameters: ParameterMetadata[]): Promise<Map<string, string> | undefined> {
        if (!parameters || parameters.length === 0) {
            return new Map();
        }

        const panel = vscode.window.createWebviewPanel(
            'scriptParameters',
            'Script Parameters',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        const paramValues = new Map<string, string>();

        return new Promise((resolve) => {
            panel.webview.html = this.getWebviewContent(parameters);

            panel.webview.onDidReceiveMessage(
                message => {
                    switch (message.command) {
                        case 'submit':
                            const values = message.values;
                            for (const [key, value] of Object.entries(values)) {
                                if (value) {
                                    paramValues.set(key, value as string);
                                }
                            }
                            panel.dispose();
                            resolve(paramValues);
                            break;
                        case 'cancel':
                            panel.dispose();
                            resolve(undefined);
                            break;
                    }
                },
                undefined
            );
        });
    }

    private getWebviewContent(parameters: ParameterMetadata[]): string {
        const inputs = parameters.map(param => `
            <div class="form-group">
                <label for="${param.name}" class="param-label">${param.name}${param.required ? ' *' : ''}</label>
                <div class="input-container">
                    <input type="text" 
                        id="${param.name}" 
                        name="${param.name}" 
                        value="${param.default || ''}"
                        placeholder="${param.description}"
                        ${param.required ? 'required' : ''}
                    />
                    <div class="description">${param.description}</div>
                </div>
            </div>
        `).join('');

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Script Parameters</title>
                <style>
                    body { 
                        padding: 20px; 
                        max-width: 800px;
                        margin: 0 auto;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                    }
                    .form-group { 
                        margin-bottom: 20px;
                        display: flex;
                        align-items: flex-start;
                        gap: 16px;
                    }
                    .param-label { 
                        min-width: 120px;
                        padding-top: 6px;
                        font-weight: 500;
                        color: var(--vscode-foreground);
                    }
                    .input-container {
                        flex: 1;
                    }
                    input { 
                        width: 100%;
                        padding: 6px 8px;
                        border: 1px solid var(--vscode-input-border);
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border-radius: 2px;
                        margin-bottom: 4px;
                    }
                    input:focus {
                        outline: 1px solid var(--vscode-focusBorder);
                        border-color: var(--vscode-focusBorder);
                    }
                    .description {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        margin-top: 4px;
                    }
                    .buttons {
                        margin-top: 24px;
                        display: flex;
                        justify-content: flex-end;
                        gap: 8px;
                    }
                    button {
                        padding: 6px 14px;
                        border: none;
                        cursor: pointer;
                        border-radius: 2px;
                        font-size: 13px;
                    }
                    button[type="submit"] {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                    button[type="submit"]:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    button[type="button"] {
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    button[type="button"]:hover {
                        background: var(--vscode-button-secondaryHoverBackground);
                    }
                </style>
            </head>
            <body>
                <form id="paramForm">
                    ${inputs}
                    <div class="buttons">
                        <button type="button" id="cancelBtn">Cancel</button>
                        <button type="submit">Run Script</button>
                    </div>
                </form>
                <script>
                    const vscode = acquireVsCodeApi();
                    document.getElementById('paramForm').addEventListener('submit', (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target);
                        const values = Object.fromEntries(formData.entries());
                        vscode.postMessage({ command: 'submit', values });
                    });
                    document.getElementById('cancelBtn').addEventListener('click', () => {
                        vscode.postMessage({ command: 'cancel' });
                    });
                </script>
            </body>
            </html>
        `;
    }
}
