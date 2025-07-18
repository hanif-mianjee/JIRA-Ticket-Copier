const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '../../manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function checkFile(filePath) {
  if (!fs.existsSync(path.join(__dirname, '../../', filePath))) {
    throw new Error(`Missing file: ${filePath}`);
  }
}

// Check required fields
[
  'manifest_version',
  'name',
  'version',
  'description',
  'content_scripts',
  'icons',
].forEach((key) => {
  if (!manifest[key]) throw new Error(`Missing manifest field: ${key}`);
});

// Check referenced files
manifest.content_scripts.forEach((cs) => {
  cs.js.forEach(checkFile);
});
Object.values(manifest.icons).forEach(checkFile);

console.log('Manifest validation passed.');
