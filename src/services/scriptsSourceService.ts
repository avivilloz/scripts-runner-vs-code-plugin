import * as vscode from 'vscode';
import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs';
import { getUserSourcesPath, ensureUserSourcesDirectory } from '../utils/pathUtils';

interface BaseConfig {
    type: 'git' | 'local';
    name?: string;
    enabled?: boolean;
    builtIn?: boolean;  // New property
}

interface GitRepoConfig extends BaseConfig {
    type: 'git';
    url: string;
    branch?: string;
    scriptsPath?: string;
}

interface LocalPathConfig extends BaseConfig {
    type: 'local';
    path: string;
}

type ScriptsSourceConfig = GitRepoConfig | LocalPathConfig;

export class ScriptsSourceService {
    private userSourcesPath: string;
    private builtInSourcesPath: string;

    constructor(private context: vscode.ExtensionContext) {
        this.userSourcesPath = getUserSourcesPath();
        this.builtInSourcesPath = path.join(context.extensionPath, 'sources');
    }

    private getRepoPath(repoUrl: string): string {
        // Create a safe directory name from the repo URL
        const repoName = repoUrl.split('/').pop()?.replace('.git', '') ||
            Buffer.from(repoUrl).toString('base64');
        return path.join(this.userSourcesPath, repoName);
    }

    async syncRepositories(): Promise<void> {
        // Ensure the scripts directory exists
        await ensureUserSourcesDirectory();

        const config = vscode.workspace.getConfiguration('scriptsRunner');
        const sources = config.get<ScriptsSourceConfig[]>('sources', []);

        if (sources.length === 0) {
            throw new Error('No script sources configured');
        }

        for (const source of sources) {
            if (source.type === 'git' && source.enabled !== false) {
                await this.syncGitRepository(source);
            } else if (source.type === 'local') {
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

        return sources
            .filter(source => source.enabled !== false)  // treat undefined as enabled
            .map(source => {
                if (source.builtIn) {
                    return path.join(this.builtInSourcesPath, 'built-in');
                }
                if (source.type === 'git') {
                    return path.join(this.getRepoPath(source.url), source.scriptsPath || 'scripts');
                }
                return source.path;
            });
    }

    // Changed method signature to use GitRepoConfig instead of non-existent BaseConfig
    private getScriptsPath(config: GitRepoConfig, basePath: string): string {
        return path.join(basePath, config.scriptsPath || 'scripts');
    }

    async initializeBuiltInSources(): Promise<void> {
        await ensureUserSourcesDirectory();

        const builtInPath = path.join(this.builtInSourcesPath, 'built-in');
        if (!fs.existsSync(builtInPath)) {
            console.warn('No built-in scripts found in extension');
            return;
        }

        // Add built-in source to configuration if not present
        const config = vscode.workspace.getConfiguration('scriptsRunner');
        const sources = config.get<ScriptsSourceConfig[]>('sources', []);

        if (!sources.some(s => s.builtIn)) {
            sources.push({
                type: 'local',
                name: 'Built-in Scripts',
                path: builtInPath,  // Point directly to extension's scripts
                builtIn: true,
                enabled: true
            });
            await config.update('sources', sources, true);
        }
    }
}
