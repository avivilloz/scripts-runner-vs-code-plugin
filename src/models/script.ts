export interface ScriptMetadata {
    name: string;
    description: string;
    category?: string;
    platforms: {
        [key in 'windows' | 'linux' | 'darwin']?: string[];
    };
    parameters?: ParameterMetadata[];
    tags?: string[];
}

export interface ParameterMetadata {
    name: string;
    description: string;
    default?: string;
    required?: boolean;
}

export interface Script {
    metadata: ScriptMetadata;
    path: string;
}