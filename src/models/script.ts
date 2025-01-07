export interface PlatformScripts {
    [platform: string]: string[] | string; // Can be array of filenames or single inline script
}

export interface ScriptMetadata {
    name: string;
    description: string;
    category?: string;
    tags?: string[];
    platforms: PlatformScripts;
    parameters?: ParameterMetadata[];
    terminal?: {
        new?: boolean;
        onExit?: {
            refresh?: boolean;
            clear?: boolean;
            close?: boolean;
        };
    };
}

export interface ParameterMetadata {
    name: string;
    description: string;
    type?: 'text' | 'select' | 'boolean';
    options?: string[];                     // Available options for 'select' type
    default?: string | boolean;             // Allow both string and boolean defaults
}

export interface Script {
    metadata: ScriptMetadata;
    path: string;
    sourceName: string;
    sourcePath: string;
    inlineScript?: string;
}