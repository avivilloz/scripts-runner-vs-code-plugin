import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

export function getUserScriptsPath(): string {
    if (vscode.env.remoteName) {
        // For remote environments (WSL/SSH), use workspace storage
        return path.join(os.homedir(), '.local', 'share', 'scripts-runner');
    }
    return path.join(os.homedir(), '.scripts-runner');
}

export function getUserSourcesPath(): string {
    if (vscode.env.remoteName) {
        // For remote environments (WSL/SSH), use workspace storage
        return path.join(os.homedir(), '.local', 'share', 'scripts-runner', 'sources');
    }
    return path.join(os.homedir(), '.scripts-runner', 'sources');
}

export async function ensureUserScriptsDirectory(): Promise<void> {
    const scriptsPath = getUserScriptsPath();
    try {
        if (!fs.existsSync(scriptsPath)) {
            await fs.promises.mkdir(scriptsPath, { recursive: true, mode: 0o755 });
        }
    } catch (error: any) {
        console.error('Failed to create scripts directory:', error);
        throw new Error(`Failed to create scripts directory: ${error.message}`);
    }
}

export async function ensureUserSourcesDirectory(): Promise<void> {
    const sourcesPath = getUserSourcesPath();
    try {
        if (!fs.existsSync(sourcesPath)) {
            await fs.promises.mkdir(sourcesPath, { recursive: true, mode: 0o755 });
        }
    } catch (error: any) {
        console.error('Failed to create sources directory:', error);
        throw new Error(`Failed to create sources directory: ${error.message}`);
    }
}

export async function copyBuiltInScripts(extensionPath: string, userScriptsPath: string): Promise<void> {
    const builtInScriptsPath = path.join(extensionPath, 'scripts', 'built-in');

    // Only copy if built-in scripts haven't been copied yet
    if (!fs.existsSync(path.join(userScriptsPath, 'built-in'))) {
        await fs.promises.cp(builtInScriptsPath, path.join(userScriptsPath, 'built-in'), {
            recursive: true
        });
    }
}

export function getEnvironmentPath(extensionUri: vscode.Uri): string {
    if (vscode.env.remoteName === 'wsl') {
        // For WSL, use the WSL extension path
        return extensionUri.path;
    } else if (vscode.env.remoteName === 'ssh-remote') {
        // For SSH, use the remote extension path
        return extensionUri.path;
    } else {
        // For local Windows/Linux/Mac
        return extensionUri.fsPath;
    }
}
