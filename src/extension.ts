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

    context.subscriptions.push(refreshCommand, executeCommand);

    // Remove initial sync to prevent error on startup
    // await gitService.syncRepository();
}

export function deactivate() { }
