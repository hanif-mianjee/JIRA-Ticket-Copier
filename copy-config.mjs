// copy-config.mjs
import { promises as fs } from "fs";
import path from "path";

const srcDir = path.resolve("src/config");
const destDir = path.resolve("dist/config");

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

copyDir(srcDir, destDir)
  .then(() => console.log("Config files copied to dist/config"))
  .catch((err) => {
    console.error("Error copying config files:", err);
    process.exit(1);
  });