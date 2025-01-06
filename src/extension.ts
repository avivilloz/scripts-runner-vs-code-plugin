import * as vscode from 'vscode';
import { ScriptsSourceService } from './services/scriptsSourceService';  // Updated import
import { ScriptService } from './services/scriptService';
import { ScriptsProvider } from './providers/scriptsProvider';
import { SourceConfigProvider } from './services/sourceConfigProvider';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Scripts Runner extension is being activated');

    const scriptsSourceService = new ScriptsSourceService(context);  // Updated variable name
    const scriptService = new ScriptService();
    const scriptsProvider = new ScriptsProvider(scriptsSourceService, scriptService);  // Updated parameter
    const sourceConfigProvider = new SourceConfigProvider(
        context,
        async () => {
            await scriptsSourceService.syncRepositories();
            await scriptsProvider.refresh();
        }
    );

    // Initialize built-in sources
    await scriptsSourceService.initializeBuiltInSources();

    // Register tree data provider
    console.log('Registering tree data provider');
    vscode.window.registerTreeDataProvider('scriptsExplorer', scriptsProvider);

    // Register all commands
    console.log('Registering extension commands');

    let refreshCommand = vscode.commands.registerCommand('scripts-runner.refresh', async () => {
        try {
            await scriptsSourceService.syncRepositories();
            await scriptsProvider.refresh();
            vscode.window.showInformationMessage('Scripts refreshed successfully');
        } catch (error: any) {
            if (error.message === 'No script sources configured') {
                const result = await vscode.window.showErrorMessage(
                    'No script sources configured. Would you like to add one now?',
                    'Yes',
                    'No'
                );
                if (result === 'Yes') {
                    sourceConfigProvider.show();
                }
            } else {
                vscode.window.showErrorMessage(`Error: ${error.message}`);
            }
        }
    });

    let executeCommand = vscode.commands.registerCommand('scripts-runner.execute', async (script) => {
        await scriptService.executeScript(script);
    });

    // Update command bar icons based on filter state
    function updateCommandIcons() {
        const hasFilters = scriptsProvider.hasActiveFilters();

        // Update filter command icon
        vscode.commands.executeCommand(
            'setContext',
            'scriptsRunner.hasFilters',
            hasFilters
        );
    }

    // Add search command
    let searchCommand = vscode.commands.registerCommand('scripts-runner.search', async () => {
        const query = await vscode.window.showInputBox({
            placeHolder: 'Search scripts...',
            prompt: 'Enter search term'
        });

        if (query !== undefined) {
            scriptsProvider.setSearchQuery(query);
            updateCommandIcons();
        }
    });

    // Replace separate filter commands with a single combined filter command
    let filterCommand = vscode.commands.registerCommand('scripts-runner.filter', async () => {
        const allCategories = scriptsProvider.getAllCategories().map(category => ({
            label: category,
            type: 'category',
            picked: scriptsProvider.getSelectedCategories().includes(category)
        }));

        const allTags = scriptsProvider.getAllTags().map(tag => ({
            label: tag,
            type: 'tag',
            picked: scriptsProvider.getSelectedTags().includes(tag)
        }));

        const allSources = scriptsProvider.getAllSources().map(source => ({
            label: source,
            type: 'source',
            picked: scriptsProvider.getSelectedSources().includes(source)
        }));

        // Combine all with headers
        const items = [
            { label: 'Sources', kind: vscode.QuickPickItemKind.Separator },
            ...allSources,
            { label: 'Categories', kind: vscode.QuickPickItemKind.Separator },
            ...allCategories,
            { label: 'Tags', kind: vscode.QuickPickItemKind.Separator },
            ...allTags
        ];

        const selected = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            placeHolder: 'Select sources, categories and tags to filter by',
            title: 'Filter Scripts'
        });

        if (selected) {
            const selectedCategories = selected
                .filter(item => 'type' in item && item.type === 'category')
                .map(item => item.label);

            const selectedTags = selected
                .filter(item => 'type' in item && item.type === 'tag')
                .map(item => item.label);

            const selectedSources = selected
                .filter(item => 'type' in item && item.type === 'source')
                .map(item => item.label);

            scriptsProvider.setSelectedCategories(selectedCategories);
            scriptsProvider.setSelectedTags(selectedTags);
            scriptsProvider.setSelectedSources(selectedSources);
            updateCommandIcons();
        }
    });

    // Add clear filters command
    let clearFiltersCommand = vscode.commands.registerCommand('scripts-runner.clearFilters', () => {
        scriptsProvider.setSearchQuery('');
        scriptsProvider.setSelectedTags([]);
        scriptsProvider.setSelectedCategories([]);
        scriptsProvider.setSelectedSources([]);  // Add this line
        updateCommandIcons();
    });

    let configureSourceCommand = vscode.commands.registerCommand('scripts-runner.configureSource', () => {
        sourceConfigProvider.show();
    });

    context.subscriptions.push(
        refreshCommand,
        executeCommand,
        searchCommand,
        filterCommand,
        clearFiltersCommand,
        configureSourceCommand
    );

    console.log('Scripts Runner extension activated successfully');
}

export function deactivate() { }
