import * as fs from 'fs';
import * as path from 'path';

// Create both the development and production directories
const directories = [
    path.join(__dirname, '..', 'out', 'node_modules', '@vscode', 'codicons', 'dist'),
    path.join(__dirname, '..', 'dist', 'node_modules', '@vscode', 'codicons', 'dist')
];

directories.forEach(dir => {
    // Create the directory structure
    fs.mkdirSync(dir, { recursive: true });

    // Copy the font file
    const sourceFile = path.join(__dirname, '..', 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.ttf');
    const targetFile = path.join(dir, 'codicon.ttf');
    fs.copyFileSync(sourceFile, targetFile);
});

console.log('Codicon font files copied successfully'); 