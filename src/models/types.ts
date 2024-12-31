import * as vscode from 'vscode';

export interface Script {
    path: string;
    metadata: ScriptMetadata;
}

export interface ScriptMetadata {
    name: string;
    description: string;
    parameters?: ParameterMetadata[];
    terminal?: TerminalSettings;
    platforms: {

        windows?: string[];

        linux?: string[];

        darwin?: string[];

    };
}

export interface ParameterMetadata {
    name: string;
    description: string;
    required?: boolean;
}

export interface TerminalSettings {
    useCurrent: boolean;
    closeOnExit?: boolean;
}

export enum ScriptType {
    Shell = '.sh',
    PowerShell = '.ps1',
    Batch = '.bat',
    Python = '.py'
}