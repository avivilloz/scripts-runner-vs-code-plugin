import * as vscode from 'vscode';
import { ScriptsSourceService } from './services/scriptsSourceService';  // Updated import
import { ScriptService } from './services/scriptService';
import { ScriptsProvider } from './providers/scriptsProvider';
import { SourceConfigProvider } from './services/sourceConfigProvider';
import { FileExtensionConfigProvider } from './services/fileExtensionConfigProvider';
import * as path from 'path';
import * as os from 'os';
import { workspace } from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Scripts Runner extension is being activated');

    // Initialize workspace-specific settings with clean state
    const config = vscode.workspace.getConfiguration('scriptsRunner');
    
    // Reset all settings if they don't exist in current workspace
    // This ensures each environment starts fresh
    if (!config.inspect('sources')?.workspaceValue) {
        // Start with empty sources except built-in
        await config.update('sources', [], false);
    }

    if (!config.inspect('fileExtensions')?.workspaceValue) {
        // Reset to default file extensions for current platform
        const builtInCommands = [
            { extension: '.sh', system: 'linux', command: 'bash', builtIn: true },
            { extension: '.sh', system: 'darwin', command: 'bash', builtIn: true },
            { extension: '.ps1', system: 'windows', command: 'powershell -File', builtIn: true },
        ];
        await config.update('fileExtensions', builtInCommands, false);
    }

    if (!config.inspect('viewType')?.workspaceValue) {
        await config.update('viewType', 'card', false);
    }

    // Get initial view type from configuration
    const initialViewType = config.get<string>('viewType', 'card');

    // Set initial view type context
    await vscode.commands.executeCommand('setContext', 'scriptsRunner:viewType', initialViewType);

    // Add configuration change listener
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async e => {
            if (e.affectsConfiguration('scriptsRunner.viewType')) {
                // Get fresh configuration
                const newConfig = vscode.workspace.getConfiguration('scriptsRunner');
                const newViewType = newConfig.get<string>('viewType', 'card');
                await vscode.commands.executeCommand('setContext', 'scriptsRunner:viewType', newViewType);
                // Refresh the view to apply changes
                await scriptsProvider.refresh();
            }
        })
    );

    const scriptsSourceService = new ScriptsSourceService(context);
    const scriptService = new ScriptService(context);
    const scriptsProvider = new ScriptsProvider(scriptsSourceService, scriptService, context);

    // Initialize built-in sources for this environment
    await scriptsSourceService.initializeBuiltInSources();

    // Initialize built-in file extension commands if none exist
    const existingCommands = config.get<any[]>('fileExtensions', []);

    if (existingCommands.length === 0) {
        const builtInCommands = [
            { extension: '.sh', system: 'linux', command: 'bash', builtIn: true },
            { extension: '.sh', system: 'darwin', command: 'bash', builtIn: true },
            { extension: '.ps1', system: 'windows', command: 'powershell -File', builtIn: true },
        ];

        await config.update('fileExtensions', builtInCommands, false);
    }

    const sourceConfigProvider = new SourceConfigProvider(
        context,
        async () => {
            await scriptsSourceService.syncRepositories();
            await scriptsProvider.refresh();
        }
    );

    const fileExtensionConfigProvider = new FileExtensionConfigProvider(
        context,
        async () => {
            await scriptsProvider.refresh();
        }
    );

    // Register both providers
    console.log('Registering providers');
    vscode.window.registerTreeDataProvider('scriptsExplorerList', scriptsProvider);
    vscode.window.registerWebviewViewProvider('scriptsExplorerCard', scriptsProvider);

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

    // Replace separate configuration commands with a single settings command
    let settingsCommand = vscode.commands.registerCommand('scripts-runner.settings', async () => {
        const items = [
            {
                label: "Manage Sources",
                description: "Configure script sources",
                action: () => sourceConfigProvider.show()
            },
            {
                label: "Manage File Extensions",
                description: "Configure file extension commands",
                action: () => fileExtensionConfigProvider.show()
            },
            {
                label: "Open Settings",
                description: "Edit configuration in Settings UI",
                action: () => vscode.commands.executeCommand('workbench.action.openWorkspaceSettings', 'scriptsRunner')
            }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a settings option',
            matchOnDescription: true
        });

        if (selected) {
            selected.action();
        }
    });

    let layoutCommand = vscode.commands.registerCommand('scripts-runner.switchLayout', async () => {
        const config = vscode.workspace.getConfiguration('scriptsRunner');
        const currentView = config.get<string>('viewType', 'card');
        const newView = currentView === 'list' ? 'card' : 'list';
        
        // Change from true to false
        await config.update('viewType', newView, false);
    });

    // Add new command registration
    let togglePinCommand = vscode.commands.registerCommand('scripts-runner.togglePin', (script) => {
        scriptsProvider.togglePin(script);
    });

    let togglePinnedViewCommand = vscode.commands.registerCommand('scripts-runner.togglePinnedView', () => {
        scriptsProvider.setShowPinnedOnly(!scriptsProvider.isShowingPinnedOnly());
        updateCommandIcons();
    });

    // Handle initial workspace folders
    await scriptsSourceService.handleWorkspaceChange();

    // Listen for workspace folder changes
    const workspaceFoldersChangeListener = workspace.onDidChangeWorkspaceFolders(async () => {
        await scriptsSourceService.handleWorkspaceChange();
        await scriptsProvider.refresh();
    });

    // Add the listener to subscriptions for cleanup
    context.subscriptions.push(workspaceFoldersChangeListener);

    context.subscriptions.push(
        refreshCommand,
        executeCommand,
        searchCommand,
        filterCommand,
        clearFiltersCommand,
        settingsCommand,
        layoutCommand,
        togglePinCommand,
        togglePinnedViewCommand
    );

    console.log('Scripts Runner extension activated successfully');
}

export function deactivate() { }
