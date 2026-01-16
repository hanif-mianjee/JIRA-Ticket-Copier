import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcPath = path.join(__dirname, 'src', 'background.js');
const destPath = path.join(__dirname, 'dist', 'background.js');

if (!fs.existsSync(path.dirname(destPath))) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
}

if (fs.existsSync(srcPath)) {
  fs.copyFileSync(srcPath, destPath);
  console.log('Background script copied to dist/');
} else {
  console.error('Background script not found!');
}
