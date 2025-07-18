// Script to copy icons from src/icons/ to dist/icons/
import { mkdir, cp } from "fs/promises";
import { dirname, join } from "path";

const icons = ["icon16.png", "icon48.png", "icon128.png"];
const srcDir = "src/icons";
const distDir = "dist/icons";

async function copyIcons() {
  await mkdir(distDir, { recursive: true });
  for (const icon of icons) {
    await cp(join(srcDir, icon), join(distDir, icon));
  }
  console.log("Icons copied to dist/icons/");
}

copyIcons();
