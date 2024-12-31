import * as vscode from 'vscode';
import { TerminalSettings } from '../models/types';

export class TerminalManager {
    private terminals: Map<string, vscode.Terminal> = new Map();

    getTerminal(settings: TerminalSettings, scriptName: string): vscode.Terminal {
        if (settings.useCurrent) {
            return vscode.window.activeTerminal || this.createTerminal(scriptName);
        }

        const existingTerminal = this.terminals.get(scriptName);
        if (existingTerminal) {
            return existingTerminal;
        }

        const newTerminal = this.createTerminal(scriptName);
        this.terminals.set(scriptName, newTerminal);
        return newTerminal;
    }

    private createTerminal(name: string): vscode.Terminal {
        return vscode.window.createTerminal(name);
    }

    disposeTerminal(name: string): void {
        const terminal = this.terminals.get(name);
        if (terminal) {
            terminal.dispose();
            this.terminals.delete(name);
        }
    }
}