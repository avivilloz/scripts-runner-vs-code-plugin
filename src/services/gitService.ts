import * as vscode from 'vscode';
import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs';

interface RepoConfig {
    url: string;
    branch?: string;
    scriptsPath?: string;
    name?: string;
}

export class GitService {
    private workspacePath: string;

    constructor(private context: vscode.ExtensionContext) {
        this.workspacePath = path.join(context.globalStorageUri.fsPath, 'scripts-repos');
        if (!fs.existsSync(this.workspacePath)) {
            fs.mkdirSync(this.workspacePath, { recursive: true });
        }
    }

    private getRepoPath(repoUrl: string): string {
        // Create a safe directory name from the repo URL
        const repoName = repoUrl.split('/').pop()?.replace('.git', '') ||
            Buffer.from(repoUrl).toString('base64');
        return path.join(this.workspacePath, repoName);
    }

    async syncRepositories(): Promise<void> {
        const config = vscode.workspace.getConfiguration('scriptsRunner');
        const repositories = config.get<RepoConfig[]>('repositories', []);

        if (repositories.length === 0) {
            throw new Error('No repositories configured');
        }

        for (const repo of repositories) {
            await this.syncSingleRepository(repo);
        }
    }

    private async syncSingleRepository(config: RepoConfig): Promise<void> {
        const repoPath = this.getRepoPath(config.url);
        console.log('Syncing repository:', config.url);
        console.log('Repository path:', repoPath);

        try {
            // Remove existing directory if it exists
            if (fs.existsSync(repoPath)) {
                await fs.promises.rm(repoPath, { recursive: true, force: true });
            }

            // Create fresh directory
            fs.mkdirSync(repoPath, { recursive: true });

            // Clone repository
            const git = simpleGit();
            await git.clone(config.url, repoPath);

            // Initialize git in the directory
            const repoGit = simpleGit(repoPath);

            // Get available branches
            const branches = await repoGit.branch();

            // Determine which branch to use
            let targetBranch = config.branch;
            if (!targetBranch) {
                targetBranch = branches.current || 'main';
                console.log('No branch configured, using:', targetBranch);
            } else if (!branches.all.includes(targetBranch)) {
                console.warn(`Configured branch ${targetBranch} not found, falling back to ${branches.current}`);
                targetBranch = branches.current || 'main';
            }

            // Switch to target branch
            await repoGit.checkout(targetBranch);
            console.log('Checked out branch:', targetBranch);

            // Ensure scripts directory exists
            const scriptsPath = this.getScriptsPath(config, repoPath);
            if (!fs.existsSync(scriptsPath)) {
                fs.mkdirSync(scriptsPath, { recursive: true });
            }

            console.log('Repository synced successfully:', config.name || config.url);
        } catch (error) {
            console.error(`Failed to sync repository ${config.url}:`, error);
            throw error;
        }
    }

    getAllScriptsPaths(): string[] {
        const config = vscode.workspace.getConfiguration('scriptsRunner');
        const repositories = config.get<RepoConfig[]>('repositories', []);

        return repositories.map(repo => this.getScriptsPath(repo, this.getRepoPath(repo.url)));
    }

    private getScriptsPath(config: RepoConfig, repoPath: string): string {
        return path.join(repoPath, config.scriptsPath || 'scripts');
    }
}
