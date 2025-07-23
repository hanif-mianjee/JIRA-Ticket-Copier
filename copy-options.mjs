// copy-options.mjs
import { promises as fs } from "fs";
import path from "path";

const srcDir = path.resolve("src/options");
const destDir = path.resolve("dist/options");

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
  .then(() => console.log("Options files copied to dist/options"))
  .catch((err) => {
    console.error("Error copying options files:", err);
    process.exit(1);
  });
