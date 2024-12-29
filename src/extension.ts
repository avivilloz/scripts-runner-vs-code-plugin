import * as vscode from 'vscode';
import { GitService } from './services/gitService';
import { ScriptService } from './services/scriptService';
import { ScriptsProvider } from './providers/scriptsProvider';

export async function activate(context: vscode.ExtensionContext) {
    const gitService = new GitService(context);
    const scriptService = new ScriptService();
    const scriptsProvider = new ScriptsProvider(gitService, scriptService);

    vscode.window.registerTreeDataProvider('scriptsExplorer', scriptsProvider);

    // Check if extension is enabled
    const isEnabled = () => vscode.workspace.getConfiguration('scriptsRunner').get('enabled', true);

    // Add enable/disable commands
    let enableCommand = vscode.commands.registerCommand('scripts-runner.enable', async () => {
        await vscode.workspace.getConfiguration('scriptsRunner').update('enabled', true, true);
        vscode.window.showInformationMessage('Scripts Runner has been enabled');
        scriptsProvider.refresh();
    });

    let disableCommand = vscode.commands.registerCommand('scripts-runner.disable', async () => {
        await vscode.workspace.getConfiguration('scriptsRunner').update('enabled', false, true);
        vscode.window.showInformationMessage('Scripts Runner has been disabled');
        scriptsProvider.refresh();
    });

    let refreshCommand = vscode.commands.registerCommand('scripts-runner.refresh', async () => {
        if (!isEnabled()) {
            vscode.window.showWarningMessage('Scripts Runner is disabled. Enable it in settings to use.');
            return;
        }
        try {
            await gitService.syncRepository();
            // Wait for the provider to refresh completely
            await scriptsProvider.refresh();
            // Show success message
            vscode.window.showInformationMessage('Scripts refreshed successfully');
        } catch (error: any) {
            if (error.message === 'Repository URL not configured') {
                const result = await vscode.window.showErrorMessage(
                    'Repository URL not configured. Would you like to configure it now?',
                    'Yes',
                    'No'
                );
                if (result === 'Yes') {
                    const url = await vscode.window.showInputBox({
                        prompt: 'Enter the Git repository URL containing your scripts',
                        placeHolder: 'https://github.com/username/repo.git'
                    });
                    if (url) {
                        const branch = await vscode.window.showInputBox({
                            prompt: 'Enter the branch name (leave empty for default branch)',
                            placeHolder: 'main'
                        });
                        await vscode.workspace.getConfiguration('scriptsRunner').update('repositoryUrl', url, true);
                        if (branch) {
                            await vscode.workspace.getConfiguration('scriptsRunner').update('branch', branch, true);
                        }
                        await gitService.syncRepository();
                        scriptsProvider.refresh();
                    }
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

        // Combine both with plain text headers
        const items = [
            { label: 'Categories', kind: vscode.QuickPickItemKind.Separator },
            ...allCategories,
            { label: 'Tags', kind: vscode.QuickPickItemKind.Separator },
            ...allTags
        ];

        const selected = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            placeHolder: 'Select categories and tags to filter by',
            title: 'Filter Scripts'
        });

        if (selected) {
            const selectedCategories = selected
                .filter(item => 'type' in item && item.type === 'category')
                .map(item => item.label);

            const selectedTags = selected
                .filter(item => 'type' in item && item.type === 'tag')
                .map(item => item.label);

            scriptsProvider.setSelectedCategories(selectedCategories);
            scriptsProvider.setSelectedTags(selectedTags);
            updateCommandIcons();
        }
    });

    // Add clear filters command
    let clearFiltersCommand = vscode.commands.registerCommand('scripts-runner.clearFilters', () => {
        scriptsProvider.setSearchQuery('');
        scriptsProvider.setSelectedTags([]);
        scriptsProvider.setSelectedCategories([]);
        updateCommandIcons();
    });

    context.subscriptions.push(
        refreshCommand,
        executeCommand,
        searchCommand,
        filterCommand,
        clearFiltersCommand,
        enableCommand,
        disableCommand
    );

    // Remove initial sync to prevent error on startup
    // await gitService.syncRepository();
}

export function deactivate() { }
