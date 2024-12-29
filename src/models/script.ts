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
        useCurrent: boolean;     // Made non-optional to ensure explicit setting
        closeOnExit?: boolean;   // Whether to close terminal after script completion
    };
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