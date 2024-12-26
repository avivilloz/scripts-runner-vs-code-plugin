import * as vscode from 'vscode';
import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs';

export class GitService {
    private git: SimpleGit;
    private workspacePath: string;

    constructor(private context: vscode.ExtensionContext) {
        this.workspacePath = path.join(context.globalStorageUri.fsPath, 'scripts-repo');
        // Create directory if it doesn't exist
        if (!fs.existsSync(this.workspacePath)) {
            fs.mkdirSync(this.workspacePath, { recursive: true });
        }
        this.git = simpleGit();
    }

    async syncRepository(): Promise<void> {
        const config = vscode.workspace.getConfiguration('scriptsRunner');
        const repoUrl = config.get<string>('repositoryUrl');
        const configuredBranch = config.get<string>('branch');

        console.log('Repository URL:', repoUrl);
        console.log('Configured Branch:', configuredBranch);
        console.log('Workspace Path:', this.workspacePath);

        if (!repoUrl) {
            throw new Error('Repository URL not configured');
        }

        try {
            // Remove existing directory if it exists
            if (fs.existsSync(this.workspacePath)) {
                await fs.promises.rm(this.workspacePath, { recursive: true, force: true });
            }

            // Create fresh directory
            fs.mkdirSync(this.workspacePath, { recursive: true });

            // Clone repository
            this.git = simpleGit();
            await this.git.clone(repoUrl, this.workspacePath);

            // Initialize git in the directory
            this.git = simpleGit(this.workspacePath);

            // Get available branches
            const branches = await this.git.branch();

            // Determine which branch to use
            let targetBranch = configuredBranch;
            if (!targetBranch) {
                targetBranch = branches.current || 'main';
                console.log('No branch configured, using:', targetBranch);
            } else if (!branches.all.includes(targetBranch)) {
                console.warn(`Configured branch ${targetBranch} not found, falling back to ${branches.current}`);
                targetBranch = branches.current || 'main';
            }

            // Switch to target branch
            await this.git.checkout(targetBranch);
            console.log('Checked out branch:', targetBranch);

            // Ensure scripts directory exists
            const scriptsPath = this.getScriptsPath();
            if (!fs.existsSync(scriptsPath)) {
                fs.mkdirSync(scriptsPath, { recursive: true });
            }

            console.log('Repository synced successfully');
            console.log('Current branch:', targetBranch);
            console.log('Scripts path:', scriptsPath);

            if (fs.existsSync(scriptsPath)) {
                console.log('Scripts directory contents:', await fs.promises.readdir(scriptsPath));
            }
        } catch (error: unknown) {
            console.error('Git operation failed:', error);
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Git operation failed: ${error.message}`);
            } else {
                vscode.window.showErrorMessage('Git operation failed with unknown error');
            }
            throw error;
        }
    }

    getScriptsPath(): string {
        const config = vscode.workspace.getConfiguration('scriptsRunner');
        return path.join(this.workspacePath, config.get<string>('scriptsPath', 'scripts'));
    }
}
