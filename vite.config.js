import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        content: "src/content.js",
        // add other entry points if needed
      },
      output: {
        entryFileNames: "content.js",
        format: "iife", // Chrome expects IIFE for content scripts
      },
    },
    outDir: "dist",
    emptyOutDir: false,
    target: "esnext",
    minify: false,
  },
});
