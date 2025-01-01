export interface ScriptMetadata {
    name: string;
    description: string;
    category?: string;
    platforms: {
        [key in 'windows' | 'linux' | 'darwin']?: string[];
    };
    parameters?: ParameterMetadata[];
    tags?: string[];
    terminal?: {
        useCurrent: boolean;
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
    required?: boolean;
    options?: string[];                     // Available options for 'select' type
    default?: string | boolean;             // Allow both string and boolean defaults
}

export interface Script {
    metadata: ScriptMetadata;
    path: string;
}