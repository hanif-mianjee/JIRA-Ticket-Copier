import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, 'src', 'popup');
const destDir = path.join(__dirname, 'dist', 'popup');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Listed explicitly so the tests next to these files are not shipped.
const files = ['popup.html', 'popup.css', 'popup.js', 'weekly-filter.js'];

files.forEach(file => {
  const srcPath = path.join(srcDir, file);
  if (!fs.existsSync(srcPath)) {
    console.error(`Popup file not found: ${file}`);
    process.exit(1);
  }
  fs.copyFileSync(srcPath, path.join(destDir, file));
});

console.log('Popup files copied to dist/popup');
