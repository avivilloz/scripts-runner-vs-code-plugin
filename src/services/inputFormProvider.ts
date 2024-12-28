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
                <label for="${param.name}">${param.name}${param.required ? ' *' : ''}</label>
                <input type="text" 
                    id="${param.name}" 
                    name="${param.name}" 
                    value="${param.default || ''}"
                    placeholder="${param.description}"
                    ${param.required ? 'required' : ''}
                />
                <div class="description">${param.description}</div>
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
                    body { padding: 10px; }
                    .form-group { margin-bottom: 15px; }
                    label { display: block; margin-bottom: 5px; }
                    input { 
                        width: 100%;
                        padding: 5px;
                        margin-bottom: 5px;
                    }
                    .description {
                        font-size: 0.9em;
                        color: #888;
                        margin-top: 2px;
                    }
                    .buttons {
                        margin-top: 20px;
                        display: flex;
                        gap: 10px;
                    }
                    button {
                        padding: 8px 16px;
                        cursor: pointer;
                    }
                </style>
            </head>
            <body>
                <form id="paramForm">
                    ${inputs}
                    <div class="buttons">
                        <button type="submit">Run Script</button>
                        <button type="button" id="cancelBtn">Cancel</button>
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
