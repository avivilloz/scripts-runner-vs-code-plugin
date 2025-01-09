import * as vscode from 'vscode';
import { ScriptsSourceService } from './services/scriptsSourceService';  // Updated import
import { ScriptService } from './services/scriptService';
import { ScriptsProvider } from './providers/scriptsProvider';
import { SourceConfigProvider } from './services/sourceConfigProvider';
import { FileExtensionConfigProvider } from './services/fileExtensionConfigProvider';
import * as path from 'path';
import * as os from 'os';
import { workspace } from 'vscode';
import { getEnvironmentPath } from './utils/pathUtils';  // We'll add this function
import { ConfigurationTarget } from 'vscode';

interface SettingsQuickPickItem extends vscode.QuickPickItem {
    action: () => void;
}

interface FilterItem extends vscode.QuickPickItem {
    type?: 'tag' | 'category' | 'source';
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('Scripts Runner extension is being activated');

    const config = vscode.workspace.getConfiguration('scriptsRunner');
    
    // Clean up any workspace settings if they exist
    if (config.inspect('sources')?.workspaceValue !== undefined) {
        await config.update('sources', undefined, ConfigurationTarget.Workspace);
    }
    if (config.inspect('fileExtensions')?.workspaceValue !== undefined) {
        await config.update('fileExtensions', undefined, ConfigurationTarget.Workspace);
    }
    if (config.inspect('viewType')?.workspaceValue !== undefined) {
        await config.update('viewType', undefined, ConfigurationTarget.Workspace);
    }

    // Initialize Global settings with defaults only if they don't exist
    // Don't copy from User settings
    const globalSources = config.inspect('sources')?.globalValue;
    if (globalSources === undefined) {
        // Start with empty sources - built-in will be added later
        await config.update('sources', [], ConfigurationTarget.Global);
    }

    const globalFileExtensions = config.inspect('fileExtensions')?.globalValue;
    if (globalFileExtensions === undefined) {
        const builtInCommands = [
            { extension: '.sh', system: 'linux', command: 'bash', builtIn: true },
            { extension: '.sh', system: 'darwin', command: 'bash', builtIn: true },
            { extension: '.ps1', system: 'windows', command: 'powershell -File', builtIn: true },
        ];
        await config.update('fileExtensions', builtInCommands, ConfigurationTarget.Global);
    }

    const globalViewType = config.inspect('viewType')?.globalValue;
    if (globalViewType === undefined) {
        await config.update('viewType', 'card', ConfigurationTarget.Global);
    }

    // Get environment-specific paths
    const environmentPath = getEnvironmentPath(context.extensionUri);

    // Initialize built-in sources with correct environment path
    const scriptsSourceService = new ScriptsSourceService(context);
    await scriptsSourceService.initializeBuiltInSources();  // This will add built-in source with correct path

    // Get initial view type from global configuration only
    const initialViewType = config.inspect('viewType')?.globalValue || 'card';
    await vscode.commands.executeCommand('setContext', 'scriptsRunner:viewType', initialViewType);

    // Use the helper for all configuration operations
    const { getGlobalConfiguration, updateGlobalConfiguration } = require('./utils/configUtils');

    // Add configuration change listener
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async e => {
            if (e.affectsConfiguration('scriptsRunner.viewType')) {
                // Get view type directly from global settings
                const newViewType = config.inspect('viewType')?.globalValue as string || 'card';
                await vscode.commands.executeCommand('setContext', 'scriptsRunner:viewType', newViewType);
                await scriptsProvider.refresh();
            }
        })
    );

    const scriptService = new ScriptService(context);
    const scriptsProvider = new ScriptsProvider(scriptsSourceService, scriptService, context);

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

        const selected = await vscode.window.showQuickPick(items as FilterItem[], {
            canPickMany: true,
            placeHolder: 'Select sources, categories and tags to filter by',
            title: 'Filter Scripts'
        });

        if (selected) {
            const selectedCategories = selected
                ?.filter((item: FilterItem) => item.type === 'category')
                .map((item: FilterItem) => item.label);

            const selectedTags = selected
                .filter((item: FilterItem) => item.type === 'tag')
                .map((item: FilterItem) => item.label);

            const selectedSources = selected
                .filter((item: FilterItem) => item.type === 'source')
                .map((item: FilterItem) => item.label);

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
        const items: SettingsQuickPickItem[] = [
            {
                label: "Manage Sources",
                description: "Configure script sources",
                action: () => sourceConfigProvider.show()
            },
            {
                label: "Manage File Extensions",
                description: "Configure file extension commands",
                action: () => fileExtensionConfigProvider.show()
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
        const currentView = config.inspect('viewType')?.globalValue as string || 'card';
        const newView = currentView === 'list' ? 'card' : 'list';
        
        // Use updateGlobalConfiguration instead
        await updateGlobalConfiguration('viewType', newView);
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
