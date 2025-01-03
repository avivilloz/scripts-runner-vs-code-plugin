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
                            console.log('Received values:', values); // Debug logging
                            for (const param of parameters) {
                                if (param.type === 'boolean') {
                                    // Explicitly handle boolean values
                                    const boolValue = values[param.name] === 'true';
                                    paramValues.set(param.name, boolValue ? 'true' : 'false');
                                    console.log(`Set boolean param ${param.name}:`, boolValue); // Debug logging
                                } else if (values[param.name]) {
                                    paramValues.set(param.name, values[param.name]);
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
        const inputs = parameters.map(param => {
            const inputHtml = this.getInputHtml(param);
            return `
                <div class="form-group">
                    <label for="${param.name}" class="param-label">${param.name}</label>
                    <div class="input-container">
                        ${inputHtml}
                        <div class="description">${param.description}</div>
                    </div>
                </div>
            `;
        }).join('');

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
                    select {
                        width: 100%;
                        padding: 6px 8px;
                        border: 1px solid var(--vscode-input-border);
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border-radius: 2px;
                        margin-bottom: 4px;
                    }
                    select:focus {
                        outline: 1px solid var(--vscode-focusBorder);
                        border-color: var(--vscode-focusBorder);
                    }
                    .checkbox-container {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    input[type="checkbox"] {
                        width: auto;
                        margin: 0;
                    }
                </style>
            </head>
            <body>
                <form id="paramForm">
                    ${inputs}
                    <div class="buttons">
                        <button type="button" id="cancelBtn">Cancel</button>
                        <button type="submit" id="submitBtn" disabled>Run Script</button>
                    </div>
                </form>
                <script>
                    const vscode = acquireVsCodeApi();
                    const form = document.getElementById('paramForm');
                    const submitBtn = document.getElementById('submitBtn');

                    // Validate form and update submit button state
                    function validateForm() {
                        const params = ${JSON.stringify(parameters)};
                        const isValid = params.every(param => {
                            const input = document.getElementById(param.name);
                            if (param.type === 'boolean') return true;
                            if (param.type === 'select') return input.value !== '';
                            return input.value.trim() !== '';
                        });
                        submitBtn.disabled = !isValid;
                    }

                    // Add validation on input changes
                    form.addEventListener('input', validateForm);
                    form.addEventListener('change', validateForm);

                    // Initial validation
                    validateForm();

                    form.addEventListener('submit', (e) => {
                        e.preventDefault();
                        const values = {};
                        
                        // Process each parameter
                        const params = ${JSON.stringify(parameters)};
                        params.forEach(param => {
                            const input = document.getElementById(param.name);
                            if (param.type === 'boolean') {
                                values[param.name] = input.checked ? 'true' : 'false';
                            } else {
                                const value = new FormData(e.target).get(param.name);
                                if (value !== null) {
                                    values[param.name] = value;
                                }
                            }
                        });

                        vscode.postMessage({ 
                            command: 'submit', 
                            values: values 
                        });
                    });

                    document.getElementById('cancelBtn').addEventListener('click', () => {
                        vscode.postMessage({ command: 'cancel' });
                    });
                </script>
            </body>
            </html>
        `;
    }

    private getInputHtml(param: ParameterMetadata): string {
        switch (param.type) {
            case 'select':
                if (!param.options?.length) {
                    return this.getTextInputHtml(param); // Fallback to text input if no options
                }
                // Use first option as default if no default is specified
                const defaultOption = param.default || param.options[0];
                return `
                    <select 
                        id="${param.name}" 
                        name="${param.name}"
                        required
                    >
                        <option value="">Select an option...</option>
                        ${param.options.map(opt => `
                            <option value="${opt}" ${opt === defaultOption ? 'selected' : ''}>
                                ${opt}
                            </option>
                        `).join('')}
                    </select>`;

            case 'boolean':
                // Handle both string and boolean default values
                const isChecked = param.default === true || param.default === 'true';
                return `
                    <div class="checkbox-container">
                        <input 
                            type="checkbox" 
                            id="${param.name}" 
                            name="${param.name}"
                            ${isChecked ? 'checked' : ''}
                        />
                        <span>Enable</span>
                    </div>`;

            case 'text':
            default:
                return this.getTextInputHtml(param);
        }
    }

    private getTextInputHtml(param: ParameterMetadata): string {
        const defaultValue = typeof param.default === 'boolean'
            ? param.default.toString()
            : (param.default || '');

        return `
            <input type="text" 
                id="${param.name}" 
                name="${param.name}" 
                value="${defaultValue}"
                placeholder="${param.description}"
                required
            />`;
    }
}
