import * as vscode from 'vscode';
import * as path from 'path';
import { ScriptsSourceService } from '../services/scriptsSourceService'; // Updated import
import { ScriptService } from '../services/scriptService';
import { Script } from '../models/script';
import { CardView } from '../views/cardView';

export class ScriptsProvider implements vscode.TreeDataProvider<Script>, vscode.WebviewViewProvider {
    private _onDidChangeTreeData: vscode.EventEmitter<Script | undefined | null | void> = new vscode.EventEmitter<Script | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Script | undefined | null | void> = this._onDidChangeTreeData.event;

    private searchQuery: string = '';
    private selectedTags: string[] = [];
    private selectedCategories: string[] = [];
    private selectedSources: string[] = [];
    private showPinnedOnly: boolean = false;
    private pinnedScripts: Set<string>;
    private scripts: Script[] = [];
    private cardView: CardView;
    private webviewView?: vscode.WebviewView;

    constructor(
        private scriptsSourceService: ScriptsSourceService,  // Updated type
        private scriptService: ScriptService,
        private context: vscode.ExtensionContext
    ) {
        this.cardView = new CardView(context, script => {
            vscode.commands.executeCommand('scripts-runner.execute', script);
        }, this);
        // Initialize pinned scripts from storage
        this.pinnedScripts = new Set(context.globalState.get<string[]>('pinnedScripts', []));
        this.loadScripts();
    }

    // Add new method to load scripts
    private async loadScripts(): Promise<void> {
        const scriptsPaths = this.scriptsSourceService.getAllScriptsPaths();
        this.scripts = await this.scriptService.findScripts(scriptsPaths);
        this._onDidChangeTreeData.fire();
    }

    async resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): Promise<void> {
        this.webviewView = webviewView;
        if (this.scripts.length === 0) {
            await this.loadScripts();
        }
        await this.refresh();
    }

    async refresh(): Promise<void> {
        this.scripts = [];
        const config = vscode.workspace.getConfiguration('scriptsRunner');
        const viewType = config.get<string>('viewType', 'list');

        // Load scripts regardless of view type
        const scriptsPaths = this.scriptsSourceService.getAllScriptsPaths();
        this.scripts = await this.scriptService.findScripts(scriptsPaths);

        if (viewType === 'card' && this.webviewView) {
            this.cardView.show(this.getFilteredScripts(), this.webviewView);
            this._onDidChangeTreeData.fire(); // Refresh tree view as well
        } else {
            this.cardView.dispose();
            this._onDidChangeTreeData.fire();
        }
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

    setSelectedSources(sources: string[]): void {
        this.selectedSources = sources;
        this.refresh();
    }

    getSelectedCategories(): string[] {
        return this.selectedCategories;
    }

    getSelectedTags(): string[] {
        return this.selectedTags;
    }

    getSelectedSources(): string[] {
        return this.selectedSources;
    }

    hasActiveFilters(): boolean {
        return this.searchQuery !== '' ||
            this.selectedTags.length > 0 ||
            this.selectedCategories.length > 0 ||
            this.selectedSources.length > 0;  // Add this line
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
        // descriptions.push(`[${element.sourceName}]`);
        if (element.metadata.category) {
            descriptions.push(`${element.metadata.category}`);
        }
        treeItem.description = `${descriptions.join('  •  ')}`;

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
        return this.getFilteredScripts();
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

    getAllSources(): string[] {
        const sourcesSet = new Set<string>();
        this.scripts.forEach(script => {
            sourcesSet.add(script.sourceName);
        });
        return Array.from(sourcesSet).sort();
    }

    // Add methods to handle favorites
    public togglePin(script: Script): void {
        const scriptId = this.getScriptId(script);
        if (this.pinnedScripts.has(scriptId)) {
            this.pinnedScripts.delete(scriptId);
        } else {
            this.pinnedScripts.add(scriptId);
        }
        // Save to storage
        this.context.globalState.update('pinnedScripts', Array.from(this.pinnedScripts));
        this.refresh();
    }

    public isPinned(script: Script): boolean {
        return this.pinnedScripts.has(this.getScriptId(script));
    }

    private getScriptId(script: Script): string {
        return `${script.sourceName}:${script.path}`;
    }

    public setShowPinnedOnly(show: boolean): void {
        this.showPinnedOnly = show;
        this.refresh();
    }

    public isShowingPinnedOnly(): boolean {
        return this.showPinnedOnly;
    }

    private getFilteredScripts(): Script[] {
        let filteredScripts = this.scripts;

        if (this.showPinnedOnly) {
            filteredScripts = filteredScripts.filter(script => 
                this.pinnedScripts.has(this.getScriptId(script))
            );
        }

        if (this.searchQuery) {
            filteredScripts = filteredScripts.filter(script =>
                script.metadata.name.toLowerCase().includes(this.searchQuery) ||
                script.metadata.description.toLowerCase().includes(this.searchQuery)
            );
        }

        if (this.selectedTags.length > 0) {
            filteredScripts = filteredScripts.filter(script =>
                script.metadata.tags?.some(tag => this.selectedTags.includes(tag))
            );
        }

        if (this.selectedCategories.length > 0) {
            filteredScripts = filteredScripts.filter(script =>
                script.metadata.category && this.selectedCategories.includes(script.metadata.category)
            );
        }

        if (this.selectedSources.length > 0) {
            filteredScripts = filteredScripts.filter(script =>
                this.selectedSources.includes(script.sourceName)
            );
        }

        return filteredScripts.sort((a, b) =>
            (a.metadata.category || '').localeCompare(b.metadata.category || '') ||
            a.metadata.name.localeCompare(b.metadata.name)
        );
    }
}
