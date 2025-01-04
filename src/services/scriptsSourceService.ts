import * as vscode from 'vscode';
import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs';

interface GitRepoConfig {
    type: 'git';
    name?: string;           // Optional: Human-readable name for the source
    url: string;            // Required: Git repository URL
    branch?: string;        // Optional: Branch to checkout
    scriptsPath?: string;   // Optional: Path to scripts directory within repo
}

interface LocalPathConfig {
    type: 'local';
    name?: string;          // Optional: Human-readable name for the source
    path: string;           // Required: Direct path to scripts directory
}

type ScriptsSourceConfig = GitRepoConfig | LocalPathConfig;

export class ScriptsSourceService {
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
        const sources = config.get<ScriptsSourceConfig[]>('sources', []);

        if (sources.length === 0) {
            throw new Error('No script sources configured');
        }

        for (const source of sources) {
            if (source.type === 'git') {
                await this.syncGitRepository(source);
            } else {
                await this.validateLocalPath(source);
            }
        }
    }

    private async syncGitRepository(config: GitRepoConfig): Promise<void> {
        const repoPath = this.getRepoPath(config.url);
        console.log('Syncing git repository:', config.url);

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

    private async validateLocalPath(config: LocalPathConfig): Promise<void> {
        console.log('Validating local path:', config.path);

        if (!path.isAbsolute(config.path)) {
            throw new Error(`Local path must be absolute: ${config.path}`);
        }

        if (!fs.existsSync(config.path)) {
            throw new Error(`Scripts path does not exist: ${config.path}`);
        }
    }

    getAllScriptsPaths(): string[] {
        const config = vscode.workspace.getConfiguration('scriptsRunner');
        const sources = config.get<ScriptsSourceConfig[]>('sources', []);

        return sources.map(source => {
            if (source.type === 'git') {
                return path.join(this.getRepoPath(source.url), source.scriptsPath || 'scripts');
            } else {
                return source.path;
            }
        });
    }

    // Changed method signature to use GitRepoConfig instead of non-existent BaseConfig
    private getScriptsPath(config: GitRepoConfig, basePath: string): string {
        return path.join(basePath, config.scriptsPath || 'scripts');
    }
}
