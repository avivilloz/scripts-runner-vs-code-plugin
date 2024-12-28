import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from '../services/gitService';
import { ScriptService } from '../services/scriptService';
import { Script } from '../models/script';

export class ScriptsProvider implements vscode.TreeDataProvider<Script> {
    private _onDidChangeTreeData: vscode.EventEmitter<Script | undefined | null | void> = new vscode.EventEmitter<Script | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Script | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(
        private gitService: GitService,
        private scriptService: ScriptService
    ) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Script): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.metadata.name);

        treeItem.command = {
            command: 'scripts-runner.execute',
            title: 'Execute Script',
            arguments: [element]
        };

        // Create detailed tooltip with markdown formatting
        const tooltip = new vscode.MarkdownString()
            .appendMarkdown(`## ${element.metadata.name}\n\n`)
            .appendMarkdown(`${element.metadata.description}\n\n`);

        if (element.metadata.category) {
            tooltip.appendMarkdown(`**Category:** ${element.metadata.category}\n\n`);
        }

        if (element.metadata.parameters?.length) {
            tooltip.appendMarkdown('**Parameters:**\n');
            element.metadata.parameters.forEach(p => {
                tooltip.appendMarkdown(`- \`${p.name}\`${p.required ? ' (required)' : ''}: ${p.description}\n`);
                if (p.default) {
                    tooltip.appendMarkdown(`  Default: \`${p.default}\`\n`);
                }
            });
        }

        treeItem.tooltip = tooltip;
        treeItem.description = undefined; // Remove the category from showing in the list
        treeItem.iconPath = new vscode.ThemeIcon('symbol-event');

        return treeItem;
    }

    async getChildren(): Promise<Script[]> {
        try {
            const scriptsPath = this.gitService.getScriptsPath();
            console.log('Getting scripts from:', scriptsPath);
            const scripts = await this.scriptService.findScripts(scriptsPath);
            console.log('Scripts found:', scripts.length);

            if (scripts.length === 0) {
                vscode.window.showInformationMessage('No scripts found. Make sure your repository contains scripts in the correct format.');
            }

            return scripts.sort((a, b) =>
                (a.metadata.category || '').localeCompare(b.metadata.category || '') ||
                a.metadata.name.localeCompare(b.metadata.name)
            );
        } catch (error: unknown) {
            console.error('Error getting scripts:', error);
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Error loading scripts: ${message}`);
            return [];
        }
    }
}
