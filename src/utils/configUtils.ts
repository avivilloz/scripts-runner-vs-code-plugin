import * as vscode from 'vscode';
import { ConfigurationTarget } from 'vscode';

export function getGlobalConfiguration<T>(section: string, defaultValue: T): T {
    const config = vscode.workspace.getConfiguration('scriptsRunner');
    const settings = config.inspect(section);
    
    // Prefer global value, fall back to default if not set
    return settings?.globalValue as T ?? defaultValue;
}

export async function updateGlobalConfiguration(section: string, value: any): Promise<void> {
    const config = vscode.workspace.getConfiguration('scriptsRunner');
    
    // Clear workspace setting if it exists
    if (config.inspect(section)?.workspaceValue !== undefined) {
        await config.update(section, undefined, ConfigurationTarget.Workspace);
    }
    
    // Update global setting
    await config.update(section, value, ConfigurationTarget.Global);
} 