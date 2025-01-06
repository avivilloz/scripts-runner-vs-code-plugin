import * as vscode from 'vscode';
import * as path from 'path';
import { ScriptsSourceService } from '../services/scriptsSourceService'; // Updated import
import { ScriptService } from '../services/scriptService';
import { Script } from '../models/script';

export class ScriptsProvider implements vscode.TreeDataProvider<Script> {
    private _onDidChangeTreeData: vscode.EventEmitter<Script | undefined | null | void> = new vscode.EventEmitter<Script | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Script | undefined | null | void> = this._onDidChangeTreeData.event;

    private searchQuery: string = '';
    private selectedTags: string[] = [];
    private selectedCategories: string[] = [];
    private scripts: Script[] = [];

    constructor(
        private scriptsSourceService: ScriptsSourceService,  // Updated type
        private scriptService: ScriptService
    ) { }

    async refresh(): Promise<void> {
        // Clear the scripts cache
        this.scripts = [];
        // Trigger the tree view update
        this._onDidChangeTreeData.fire();
    }

    setSearchQuery(query: string): void {
        this.searchQuery = query.toLowerCase();
        this.refresh();
    }

    setSelectedTags(tags: string[]): void {
        this.selectedTags = tags;
        this.refresh();
    }

    setSelectedCategories(categories: string[]): void {
        this.selectedCategories = categories;
        this.refresh();
    }

    getSelectedCategories(): string[] {
        return this.selectedCategories;
    }

    getSelectedTags(): string[] {
        return this.selectedTags;
    }

    hasActiveFilters(): boolean {
        return this.searchQuery !== '' ||
            this.selectedTags.length > 0 ||
            this.selectedCategories.length > 0;
    }

    getTreeItem(element: Script): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.metadata.name);

        treeItem.command = {
            command: 'scripts-runner.execute',
            title: 'Execute Script',
            arguments: [element]
        };

        // Combine category and source in the description
        const descriptions: string[] = [];
        if (element.metadata.category) {
            descriptions.push(element.metadata.category);
        }
        descriptions.push(element.sourceName);
        treeItem.description = descriptions.join(' • ');

        // Create detailed tooltip with markdown formatting
        const tooltip = new vscode.MarkdownString()
            .appendMarkdown(`## ${element.metadata.name}\n\n`)
            .appendMarkdown(`${element.metadata.description}\n\n`)
            .appendMarkdown(`**Source:** ${element.sourceName}\n\n`);

        if (element.metadata.category) {
            tooltip.appendMarkdown(`**Category:** ${element.metadata.category}\n\n`);
        }

        if (element.metadata.tags?.length) {
            tooltip.appendMarkdown(`**Tags:** ${element.metadata.tags.join(', ')}\n\n`);
        }

        if (element.metadata.parameters?.length) {
            tooltip.appendMarkdown('**Parameters:**\n');
            element.metadata.parameters.forEach(p => {
                const defaultValue = p.type === 'boolean'
                    ? `(default: ${p.default ? 'true' : 'false'})`
                    : p.default ? `(default: ${p.default})` : '';
                tooltip.appendMarkdown(`- \`${p.name}\`: ${p.description} ${defaultValue}\n`);
            });
        }

        treeItem.tooltip = tooltip;
        treeItem.iconPath = new vscode.ThemeIcon('symbol-event');

        return treeItem;
    }

    async getChildren(): Promise<Script[]> {
        try {
            if (this.scripts.length === 0) {
                const scriptsPaths = this.scriptsSourceService.getAllScriptsPaths();
                this.scripts = await this.scriptService.findScripts(scriptsPaths);
            }

            let filteredScripts = this.scripts;

            // Apply search filter
            if (this.searchQuery) {
                filteredScripts = filteredScripts.filter(script =>
                    script.metadata.name.toLowerCase().includes(this.searchQuery) ||
                    script.metadata.description.toLowerCase().includes(this.searchQuery)
                );
            }

            // Apply tag filter
            if (this.selectedTags.length > 0) {
                filteredScripts = filteredScripts.filter(script =>
                    script.metadata.tags?.some(tag => this.selectedTags.includes(tag))
                );
            }

            // Apply category filter
            if (this.selectedCategories.length > 0) {
                filteredScripts = filteredScripts.filter(script =>
                    script.metadata.category && this.selectedCategories.includes(script.metadata.category)
                );
            }

            // Sort scripts by category and name
            return filteredScripts.sort((a, b) =>
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

    getAllTags(): string[] {
        const tagsSet = new Set<string>();
        this.scripts.forEach(script => {
            script.metadata.tags?.forEach(tag => tagsSet.add(tag));
        });
        return Array.from(tagsSet).sort();
    }

    getAllCategories(): string[] {
        const categoriesSet = new Set<string>();
        this.scripts.forEach(script => {
            if (script.metadata.category) {
                categoriesSet.add(script.metadata.category);
            }
        });
        return Array.from(categoriesSet).sort();
    }
}
