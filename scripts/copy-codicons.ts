import * as fs from 'fs';
import * as path from 'path';

// Create the directory structure
const targetDir = path.join(__dirname, '..', 'out', 'node_modules', '@vscode', 'codicons', 'dist');
fs.mkdirSync(targetDir, { recursive: true });

// Copy the font file
const sourceFile = path.join(__dirname, '..', 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.ttf');
const targetFile = path.join(targetDir, 'codicon.ttf');
fs.copyFileSync(sourceFile, targetFile);

console.log('Codicon font files copied successfully'); 