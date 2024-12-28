import * as vscode from 'vscode';
import { GitService } from './services/gitService';
import { ScriptService } from './services/scriptService';
import { ScriptsProvider } from './providers/scriptsProvider';

export async function activate(context: vscode.ExtensionContext) {
    const gitService = new GitService(context);
    const scriptService = new ScriptService();
    const scriptsProvider = new ScriptsProvider(gitService, scriptService);

    vscode.window.registerTreeDataProvider('scriptsExplorer', scriptsProvider);

    let refreshCommand = vscode.commands.registerCommand('scripts-runner.refresh', async () => {
        try {
            await gitService.syncRepository();
            scriptsProvider.refresh();
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

    // Add search command
    let searchCommand = vscode.commands.registerCommand('scripts-runner.search', async () => {
        const query = await vscode.window.showInputBox({
            placeHolder: 'Search scripts...',
            prompt: 'Enter search term'
        });

        if (query !== undefined) {
            scriptsProvider.setSearchQuery(query);
        }
    });

    // Add filter by tags command
    let filterTagsCommand = vscode.commands.registerCommand('scripts-runner.filterTags', async () => {
        const allTags = scriptsProvider.getAllTags();
        const selectedTags = await vscode.window.showQuickPick(allTags, {
            canPickMany: true,
            placeHolder: 'Select tags to filter by'
        });

        if (selectedTags) {
            scriptsProvider.setSelectedTags(selectedTags);
        }
    });

    // Add clear filters command
    let clearFiltersCommand = vscode.commands.registerCommand('scripts-runner.clearFilters', () => {
        scriptsProvider.setSearchQuery('');
        scriptsProvider.setSelectedTags([]);
    });

    context.subscriptions.push(
        refreshCommand,
        executeCommand,
        searchCommand,
        filterTagsCommand,
        clearFiltersCommand
    );

    // Remove initial sync to prevent error on startup
    // await gitService.syncRepository();
}

export function deactivate() { }
