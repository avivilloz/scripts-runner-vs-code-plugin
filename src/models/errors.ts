export class ScriptExecutionError extends Error {
    constructor(
        message: string,
        public readonly originalError?: Error
    ) {
        super(message);
        this.name = 'ScriptExecutionError';
    }
}