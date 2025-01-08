import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

export function getUserScriptsPath(): string {
    return path.join(os.homedir(), '.scripts-runner', 'scripts');
}

export function getUserSourcesPath(): string {
    if (vscode.env.remoteName) {
        // For remote environments (WSL/SSH)
        return path.join('/', '.scripts-runner', 'sources');
    }
    return path.join(os.homedir(), '.scripts-runner', 'sources');
}

export async function ensureUserScriptsDirectory(): Promise<void> {
    const scriptsPath = getUserScriptsPath();
    if (!fs.existsSync(scriptsPath)) {
        await fs.promises.mkdir(scriptsPath, { recursive: true });
    }
}

export async function ensureUserSourcesDirectory(): Promise<void> {
    const sourcesPath = getUserSourcesPath();
    if (!fs.existsSync(sourcesPath)) {
        await fs.promises.mkdir(sourcesPath, { recursive: true });
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
